import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const couponSchema = z.object({
  code: z.string().min(1).max(20).transform((v) => v.toUpperCase()),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  type: z.enum(["GLOBAL", "PRODUCT", "CATEGORY"]),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().nonnegative(),
  maxDiscount: z.number().positive(),
  usageLimit: z.number().int().positive(),
  perUserLimit: z.number().int().positive(),
  startDate: z.union([z.string().datetime(), z.string().date()]),
  endDate: z.union([z.string().datetime(), z.string().date()]),
  isActive: z.boolean().default(true),
  productIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
});

// GET /api/admin/coupons - List all coupons
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupons = await (db as any).coupon.findMany({
      include: {
        products: {
          include: { product: { select: { id: true, name: true } } },
        },
        categories: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      coupons: coupons.map((c: any) => ({
        ...c,
        products: c.products.map((p: any) => p.product),
        categories: c.categories.map((cat: any) => cat.category),
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/coupons]", error);
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

// POST /api/admin/coupons - Create a new coupon
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("[POST /api/admin/coupons] Received body:", JSON.stringify(body, null, 2));
    
    const data = couponSchema.parse(body);
    console.log("[POST /api/admin/coupons] Parsed data:", JSON.stringify(data, null, 2));

    // Check for duplicate code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db as any).coupon.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
    }

    // Validate product/category selections
    if (data.type === "PRODUCT" && (!data.productIds || data.productIds.length === 0)) {
      return NextResponse.json({ error: "At least one product required" }, { status: 400 });
    }
    if (data.type === "CATEGORY" && (!data.categoryIds || data.categoryIds.length === 0)) {
      return NextResponse.json({ error: "At least one category required" }, { status: 400 });
    }

    // Validate dates
    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) >= new Date(data.endDate)) {
        return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = await (db as any).coupon.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        type: data.type,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount,
        maxDiscount: data.maxDiscount,
        usageLimit: data.usageLimit,
        perUserLimit: data.perUserLimit,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive,
        products: data.type === "PRODUCT" && data.productIds ? {
          create: data.productIds.map((id) => ({ productId: id })),
        } : undefined,
        categories: data.type === "CATEGORY" && data.categoryIds ? {
          create: data.categoryIds.map((id) => ({ categoryId: id })),
        } : undefined,
      },
    });

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/coupons]", error);
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      console.error("[POST /api/admin/coupons] Validation errors:", issues);
      return NextResponse.json({ error: `Invalid input: ${issues}` }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}
