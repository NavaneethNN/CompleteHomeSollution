import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const couponUpdateSchema = z.object({
  code: z.string().min(1).max(20).transform((v) => v.toUpperCase()).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500),
  type: z.enum(["GLOBAL", "PRODUCT", "CATEGORY"]).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.number().positive().optional(),
  minOrderAmount: z.number().nonnegative(),
  maxDiscount: z.number().positive(),
  usageLimit: z.number().int().positive(),
  perUserLimit: z.number().int().positive(),
  startDate: z.union([z.string().datetime(), z.string().date()]),
  endDate: z.union([z.string().datetime(), z.string().date()]),
  isActive: z.boolean().optional(),
  productIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
});

// GET /api/admin/coupons/[id] - Get coupon details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = await (db as any).coupon.findUnique({
      where: { id },
      include: {
        products: {
          include: { product: { select: { id: true, name: true } } },
        },
        categories: {
          include: { category: { select: { id: true, name: true } } },
        },
        _count: { select: { orders: true } },
      },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...coupon,
      products: coupon.products.map((p: any) => p.product),
      categories: coupon.categories.map((c: any) => c.category),
    });
  } catch (error) {
    console.error("[GET /api/admin/coupons/[id]]", error);
    return NextResponse.json({ error: "Failed to fetch coupon" }, { status: 500 });
  }
}

// PUT /api/admin/coupons/[id] - Update coupon
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const data = couponUpdateSchema.parse(body);

    // Check if coupon exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db as any).coupon.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    // Check for duplicate code if changing code
    if (data.code && data.code !== existing.code) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const duplicate = await (db as any).coupon.findUnique({ where: { code: data.code } });
      if (duplicate) {
        return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
      }
    }

    // Validate product/category selections
    if (data.type === "PRODUCT" && data.productIds?.length === 0) {
      return NextResponse.json({ error: "At least one product required" }, { status: 400 });
    }
    if (data.type === "CATEGORY" && data.categoryIds?.length === 0) {
      return NextResponse.json({ error: "At least one category required" }, { status: 400 });
    }

    // Validate dates
    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) >= new Date(data.endDate)) {
        return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
      }
    }

    // Update coupon
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      ...(data.code && { code: data.code }),
      ...(data.name && { name: data.name }),
      description: data.description,
      ...(data.type && { type: data.type }),
      ...(data.discountType && { discountType: data.discountType }),
      ...(data.discountValue && { discountValue: data.discountValue }),
      minOrderAmount: data.minOrderAmount,
      maxDiscount: data.maxDiscount,
      usageLimit: data.usageLimit,
      perUserLimit: data.perUserLimit,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = await (db as any).coupon.update({
      where: { id },
      data: updateData,
    });

    // Update product/category relations if type changed or specific selections changed
    if (data.type === "GLOBAL") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).couponProduct.deleteMany({ where: { couponId: id } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).couponCategory.deleteMany({ where: { couponId: id } });
    } else if (data.type === "PRODUCT" && data.productIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).couponProduct.deleteMany({ where: { couponId: id } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).couponProduct.createMany({
        data: data.productIds.map((productId: string) => ({ couponId: id, productId })),
      });
    } else if (data.type === "CATEGORY" && data.categoryIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).couponCategory.deleteMany({ where: { couponId: id } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).couponCategory.createMany({
        data: data.categoryIds.map((categoryId: string) => ({ couponId: id, categoryId })),
      });
    }

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error("[PUT /api/admin/coupons/[id]]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}

// DELETE /api/admin/coupons/[id] - Delete coupon
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if coupon has been used in orders
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = await (db as any).coupon.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    if (coupon._count.orders > 0) {
      // Instead of deleting, deactivate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).coupon.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: "Coupon deactivated (has existing orders)" });
    }

    // Delete relations first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).couponProduct.deleteMany({ where: { couponId: id } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).couponCategory.deleteMany({ where: { couponId: id } });

    // Delete coupon
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).coupon.delete({ where: { id } });

    return NextResponse.json({ message: "Coupon deleted" });
  } catch (error) {
    console.error("[DELETE /api/admin/coupons/[id]]", error);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}
