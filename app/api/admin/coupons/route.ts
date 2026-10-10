import { NextRequest, NextResponse } from "next/server";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { z } from "zod";

const couponSchema = z.object({
  code: z.string().min(1).max(20).transform((v) => v.toUpperCase()),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(["GLOBAL", "PRODUCT", "CATEGORY"]),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  maxDiscount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  memberEligibility: z.enum(["ALL", "MEMBERS_ONLY", "NON_MEMBERS"]).default("ALL"),
  startDate: z.union([z.string().datetime(), z.string().date()]).optional().nullable(),
  endDate: z.union([z.string().datetime(), z.string().date()]).optional().nullable(),
  isActive: z.boolean().default(true),
  productIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
});

// GET /api/admin/coupons - List all coupons
export async function GET() {
  try {
    if (!await hasFreshAdminSession()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coupons = await db.coupon.findMany({
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
      coupons: coupons.map((c) => ({
        ...c,
        products: c.products.map((p) => p.product),
        categories: c.categories.map((cat) => cat.category),
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
    if (!await hasFreshAdminSession()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    
    const data = couponSchema.parse(body);

    // Check for duplicate code
    const existing = await db.coupon.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
    }

    if (data.discountType === "PERCENTAGE" && data.discountValue > 100) {
      return NextResponse.json({ error: "Percentage discount cannot exceed 100" }, { status: 400 });
    }

    // Validate product/category selections
    if (data.type === "PRODUCT" && (!data.productIds || data.productIds.length === 0)) {
      return NextResponse.json({ error: "At least one product required" }, { status: 400 });
    }
    if (data.type === "CATEGORY" && (!data.categoryIds || data.categoryIds.length === 0)) {
      return NextResponse.json({ error: "At least one category required" }, { status: 400 });
    }

    // Validate dates (only if both are provided and non-empty)
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate as string);
      const end = new Date(data.endDate as string);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
      }
      if (start >= end) {
        return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
      }
    }

    const coupon = await db.coupon.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description && data.description !== "" ? data.description : null,
        type: data.type,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount,
        maxDiscount: data.maxDiscount,
        usageLimit: data.usageLimit,
        perUserLimit: data.perUserLimit,
        memberEligibility: data.memberEligibility,
        startDate: data.startDate && data.startDate !== "" ? new Date(data.startDate) : null,
        endDate: data.endDate && data.endDate !== "" ? new Date(data.endDate) : null,
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
