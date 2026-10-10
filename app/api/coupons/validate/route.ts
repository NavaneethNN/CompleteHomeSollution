import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { calculateCartPricing, moneyToCents } from "@/lib/cart-pricing";
import { hasActiveMembership } from "@/lib/membership";
import { resolveMemberPrice } from "@/lib/member-price";

const itemsSchema = z.array(z.object({
  productId: z.string().cuid(),
  variantId: z.preprocess(value => value === null ? undefined : value, z.string().cuid().optional()),
  quantity: z.number().int().positive().max(100),
}).strip()).min(1).max(50);

const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(20),
  items: itemsSchema,
  addMembership: z.boolean().optional(),
});

async function validateCoupon(input: z.infer<typeof validateCouponSchema>) {
  const code = input.code.toUpperCase();
  const items = input.items;
  
  const keys = items.map(item => `${item.productId}:${item.variantId ?? "base"}`);
  if (new Set(keys).size !== keys.length) {
    return NextResponse.json({ error: "Duplicate cart items" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const productIds = [...new Set(items.map(item => item.productId))];
  const [coupon, products, membership] = await Promise.all([
    db.coupon.findUnique({
      where: { code },
      include: { products: { select: { productId: true } }, categories: { select: { categoryId: true } } },
    }),
    db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true, categoryId: true, basePrice: true, memberPrice: true,
        productVariants: { where: { isActive: true }, select: { id: true, price: true, memberPrice: true } },
      },
    }),
    userId ? db.user.findUnique({ where: { id: userId }, select: { isMember: true, membershipExpiry: true } }) : null,
  ]);
  
  if (!coupon) return NextResponse.json({ error: "Invalid coupon code" }, { status: 404 });
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "One or more products are unavailable" }, { status: 400 });
  }
  
  const now = new Date();
  if (!coupon.isActive) return NextResponse.json({ error: "This coupon is no longer active" }, { status: 400 });
  if (coupon.startDate && coupon.startDate > now) {
    return NextResponse.json({ error: "This coupon is not yet valid" }, { status: 400 });
  }
  if (coupon.endDate && coupon.endDate < now) {
    return NextResponse.json({ error: "This coupon has expired" }, { status: 400 });
  }
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return NextResponse.json({ error: "This coupon has reached its usage limit" }, { status: 400 });
  }

  const activeMember = hasActiveMembership(membership);
  const addingMembership = input.addMembership === true && !!userId && !activeMember;
  const effectiveMember = activeMember || addingMembership;
  
  if (coupon.memberEligibility === "MEMBERS_ONLY" && !activeMember) {
    return NextResponse.json({ error: "This coupon is only available for members" }, { status: 400 });
  }
  if (coupon.memberEligibility === "NON_MEMBERS" && activeMember) {
    return NextResponse.json({ error: "This coupon is only available for non-members" }, { status: 400 });
  }
  
  if (coupon.perUserLimit != null && userId) {
    const uses = await db.userCoupon.count({ where: { userId, couponId: coupon.id } });
    if (uses >= coupon.perUserLimit) {
      return NextResponse.json({ error: "Coupon usage limit reached for your account" }, { status: 400 });
    }
  }

  const eligibleProductIds = new Set(
    coupon.type === "PRODUCT"
      ? coupon.products.map(item => item.productId)
      : coupon.type === "CATEGORY"
        ? products.filter(product => coupon.categories.some(category => category.categoryId === product.categoryId)).map(product => product.id)
        : products.map(product => product.id)
  );
  
  const lines = items.map(item => {
    const product = products.find(value => value.id === item.productId)!;
    const variant = item.variantId ? product.productVariants.find(value => value.id === item.variantId) : null;
    if (item.variantId && !variant) throw new Error("INVALID_VARIANT");
    const regularPrice = variant?.price ?? product.basePrice;
    const memberPrice = resolveMemberPrice(regularPrice, variant?.memberPrice, product.memberPrice);
    const price = effectiveMember && memberPrice !== null ? memberPrice : regularPrice;
    return { 
      key: `${item.productId}:${item.variantId ?? "base"}`, 
      quantity: item.quantity, 
      unitPriceCents: moneyToCents(price), 
      eligible: eligibleProductIds.has(item.productId) 
    };
  });
  
  const base = calculateCartPricing(lines);
  if (base.applicableSubtotalCents <= 0) {
    return NextResponse.json({ error: "This coupon is not valid for the items in your cart" }, { status: 400 });
  }
  if (coupon.minOrderAmount != null && base.applicableSubtotalCents < moneyToCents(coupon.minOrderAmount)) {
    return NextResponse.json({ 
      error: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required` 
    }, { status: 400 });
  }
  
  const priced = calculateCartPricing(lines, { 
    type: coupon.discountType, 
    value: coupon.discountValue, 
    maxDiscount: coupon.maxDiscount 
  });
  
  return NextResponse.json({
    valid: true,
    coupon: {
      id: coupon.id, 
      code: coupon.code, 
      name: coupon.name, 
      description: coupon.description,
      type: coupon.type, 
      discountType: coupon.discountType, 
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount, 
      discount: priced.discountCents / 100,
      applicableSubtotal: priced.applicableSubtotalCents / 100,
      subtotal: priced.grossSubtotalCents / 100,
      discountedSubtotal: priced.subtotalCents / 100,
      memberEligibility: coupon.memberEligibility,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
    const rawItems = req.nextUrl.searchParams.get("items");
    if (!code || code.length > 20) return NextResponse.json({ error: "Coupon code required" }, { status: 400 });
    if (!rawItems || rawItems.length > 20_000) return NextResponse.json({ error: "Invalid items format" }, { status: 400 });
    let items: z.infer<typeof itemsSchema>;
    try {
      items = itemsSchema.parse(JSON.parse(rawItems));
    } catch {
      return NextResponse.json({ error: "Invalid items format" }, { status: 400 });
    }
    
    const addMembership = req.nextUrl.searchParams.get("addMembership") === "true";
    return await validateCoupon({ code, items, addMembership });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_VARIANT") {
      return NextResponse.json({ error: "Variant not found" }, { status: 400 });
    }
    // SEC-6: Log full error server-side only, never expose to client
    console.error("[GET /api/coupons/validate]", error);
    // Return generic error in all environments
    return NextResponse.json({ error: "Failed to validate coupon. Please try again." }, { status: 500 });
  }
}

// CODE-6: Add POST handler for coupon validation
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const input = validateCouponSchema.parse(body);
    return await validateCoupon(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "INVALID_VARIANT") {
      return NextResponse.json({ error: "Variant not found" }, { status: 400 });
    }
    console.error("[POST /api/coupons/validate]", error);
    return NextResponse.json({ error: "Failed to validate coupon. Please try again." }, { status: 500 });
  }
}
