import { NextRequest, NextResponse } from "next/server";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const couponUpdateSchema = z.object({
  code: z.string().min(1).max(20).transform((v) => v.toUpperCase()).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(["GLOBAL", "PRODUCT", "CATEGORY"]).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.number().positive().optional(),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  maxDiscount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  memberEligibility: z.enum(["ALL", "MEMBERS_ONLY", "NON_MEMBERS"]).optional(),
  startDate: z.union([z.string().datetime(), z.string().date()]).optional().nullable(),
  endDate: z.union([z.string().datetime(), z.string().date()]).optional().nullable(),
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
    if (!await hasFreshAdminSession()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const coupon = await db.coupon.findUnique({
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
      products: coupon.products.map((p) => p.product),
      categories: coupon.categories.map((c) => c.category),
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
    if (!await hasFreshAdminSession()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const data = couponUpdateSchema.parse(body);

    // Check if coupon exists
    const existing = await db.coupon.findUnique({ where: { id }, include: { products: true, categories: true } });
    if (!existing) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    // Check for duplicate code if changing code
    if (data.code && data.code !== existing.code) {
      const duplicate = await db.coupon.findUnique({ where: { code: data.code } });
      if (duplicate) {
        return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
      }
    }

    const type = data.type ?? existing.type;
    const productIds = [...new Set(data.productIds ?? existing.products.map(item => item.productId))];
    const categoryIds = [...new Set(data.categoryIds ?? existing.categories.map(item => item.categoryId))];
    if ((type === "PRODUCT" && !productIds.length) || (type === "CATEGORY" && !categoryIds.length)) {
      return NextResponse.json({ error: "At least one applicable product or category is required" }, { status: 400 });
    }
    const startDate = data.startDate === undefined ? existing.startDate : data.startDate ? new Date(data.startDate) : null;
    const endDate = data.endDate === undefined ? existing.endDate : data.endDate ? new Date(data.endDate) : null;
    if (startDate && endDate && startDate >= endDate) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }
    if ((data.discountType ?? existing.discountType) === "PERCENTAGE" && (data.discountValue ?? existing.discountValue) > 100) {
      return NextResponse.json({ error: "Percentage discount cannot exceed 100" }, { status: 400 });
    }

    // Update coupon
    const updateData: Prisma.CouponUpdateInput = {
      ...(data.code && { code: data.code }),
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description && data.description !== "" ? data.description : null }),
      ...(data.type && { type: data.type }),
      ...(data.discountType && { discountType: data.discountType }),
      ...(data.discountValue && { discountValue: data.discountValue }),
      ...(data.minOrderAmount !== undefined && { minOrderAmount: data.minOrderAmount }),
      ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount }),
      ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit }),
      ...(data.perUserLimit !== undefined && { perUserLimit: data.perUserLimit }),
      ...(data.memberEligibility && { memberEligibility: data.memberEligibility }),
      ...(data.startDate !== undefined && { startDate }),
      ...(data.endDate !== undefined && { endDate }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };

    // Nested relation replacement commits with the coupon itself or rolls back.
    if (data.type !== undefined || data.productIds !== undefined || data.categoryIds !== undefined) {
      updateData.products = { deleteMany: {}, create: type === "PRODUCT" ? productIds.map(productId => ({ productId })) : [] };
      updateData.categories = { deleteMany: {}, create: type === "CATEGORY" ? categoryIds.map(categoryId => ({ categoryId })) : [] };
    }
    const coupon = await db.coupon.update({ where: { id }, data: updateData });

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
    if (!await hasFreshAdminSession()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if coupon has been used in orders
    const coupon = await db.coupon.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    if (coupon._count.orders > 0) {
      // Instead of deleting, deactivate
      await db.coupon.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: "Coupon deactivated (has existing orders)" });
    }

    // Delete relations first
    await db.couponProduct.deleteMany({ where: { couponId: id } });
    await db.couponCategory.deleteMany({ where: { couponId: id } });

    // Delete coupon
    await db.coupon.delete({ where: { id } });

    return NextResponse.json({ message: "Coupon deleted" });
  } catch (error) {
    console.error("[DELETE /api/admin/coupons/[id]]", error);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}
