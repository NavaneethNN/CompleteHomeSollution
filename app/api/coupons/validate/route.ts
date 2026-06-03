import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Type for coupon with relations
 type CouponWithRelations = Prisma.CouponGetPayload<{
  include: {
    products: { select: { productId: true } };
    categories: { select: { categoryId: true } };
  };
}>;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.toUpperCase().trim();
    const itemsJson = searchParams.get("items");
    const subtotalParam = searchParams.get("subtotal");
    const subtotal = subtotalParam ? parseFloat(subtotalParam) : 0;
    const userId = searchParams.get("userId");

    console.log("[Coupon Validate] Request:", { code, subtotal, userId });

    if (!code) {
      return NextResponse.json({ error: "Coupon code required" }, { status: 400 });
    }

    let items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      price: number;
    }> = [];
    
    if (itemsJson) {
      try {
        items = JSON.parse(itemsJson);
        console.log("[Coupon Validate] Items:", items.length);
      } catch (e) {
        console.error("[Coupon Validate] Items parse error:", e);
        return NextResponse.json({ error: "Invalid items format" }, { status: 400 });
      }
    }

    // Find the coupon
    let coupon: CouponWithRelations | null = null;
    try {
      coupon = await db.coupon.findUnique({
        where: { code },
        include: {
          products: { select: { productId: true } },
          categories: { select: { categoryId: true } },
        },
      });
    } catch (dbError) {
      console.error("[Coupon Validate] DB Query Error:", dbError);
      return NextResponse.json(
        { error: "Database error. Please check if coupon tables exist." },
        { status: 500 }
      );
    }

    console.log("[Coupon Validate] Coupon found:", coupon ? "yes" : "no");

    if (!coupon) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 404 });
    }

    // Check if active
    if (coupon.isActive === false) {
      return NextResponse.json({ error: "This coupon is no longer active" }, { status: 400 });
    }

    // Check date validity
    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return NextResponse.json({ error: "This coupon is not yet valid" }, { status: 400 });
    }
    if (coupon.endDate && new Date(coupon.endDate) < now) {
      return NextResponse.json({ error: "This coupon has expired" }, { status: 400 });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return NextResponse.json({ error: "This coupon has reached its usage limit" }, { status: 400 });
    }

    // Check member eligibility
    const isMemberParam = searchParams.get("isMember") === "true";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberEligibility = (coupon as any).memberEligibility || "ALL";
    
    console.log("[Coupon Validate] Member check:", { memberEligibility, isMember: isMemberParam, userId });
    
    if (memberEligibility === "MEMBERS_ONLY" && !isMemberParam) {
      return NextResponse.json(
        { error: "This coupon is only available for members" },
        { status: 400 }
      );
    }
    
    if (memberEligibility === "NON_MEMBERS" && isMemberParam) {
      return NextResponse.json(
        { error: "This coupon is only available for non-members" },
        { status: 400 }
      );
    }

    // Check per-user limit
    if (coupon.perUserLimit && userId) {
      try {
        const userUsageCount = await db.userCoupon.count({
          where: {
            userId: userId,
            couponId: coupon.id,
          },
        });
        if (userUsageCount >= coupon.perUserLimit) {
          return NextResponse.json(
            { error: `You have already used this coupon ${userUsageCount} time(s) (limit: ${coupon.perUserLimit})` },
            { status: 400 }
          );
        }
      } catch (e) {
        console.error("[Coupon Validate] User limit check error:", e);
      }
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return NextResponse.json(
        { error: `Minimum order amount of $${Number(coupon.minOrderAmount).toFixed(2)} required` },
        { status: 400 }
      );
    }

    // Calculate discount based on coupon type
    let applicableSubtotal = subtotal;
    let discount = 0;
    const couponType = coupon.type;

    console.log("[Coupon Validate] Coupon type:", couponType);

    if (couponType === "PRODUCT") {
      // Only apply to specific products
      const applicableProductIds = coupon.products?.map((p: { productId: string }) => p.productId) || [];
      console.log("[Coupon Validate] Applicable products:", applicableProductIds);
      
      applicableSubtotal = items
        .filter((item) => applicableProductIds.includes(item.productId))
        .reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
      
      console.log("[Coupon Validate] Product applicable subtotal:", applicableSubtotal);
      
      if (applicableSubtotal === 0) {
        return NextResponse.json(
          { error: "This coupon is not valid for the items in your cart" },
          { status: 400 }
        );
      }
    } else if (couponType === "CATEGORY") {
      // Need to fetch product categories
      const applicableCategoryIds = coupon.categories?.map((c: { categoryId: string }) => c.categoryId) || [];
      console.log("[Coupon Validate] Applicable categories:", applicableCategoryIds);
      
      const productIds = items.map((i) => i.productId).filter(Boolean);
      
      if (productIds.length > 0) {
        try {
          const products = await db.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, categoryId: true },
          });

          applicableSubtotal = items
            .filter((item) => {
              const product = products.find((p) => p.id === item.productId);
              return product && applicableCategoryIds.includes(product.categoryId);
            })
            .reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

          console.log("[Coupon Validate] Category applicable subtotal:", applicableSubtotal);
        } catch (e) {
          console.error("[Coupon Validate] Category check error:", e);
        }
      }

      if (applicableSubtotal === 0) {
        return NextResponse.json(
          { error: "This coupon is not valid for the items in your cart" },
          { status: 400 }
        );
      }
    }

    // Calculate discount
    const discountType = coupon.discountType;
    const discountValue = Number(coupon.discountValue) || 0;
    const maxDiscount = coupon.maxDiscount ? Number(coupon.maxDiscount) : null;

    console.log("[Coupon Validate] Discount calculation:", { discountType, discountValue, applicableSubtotal });

    if (discountType === "PERCENTAGE") {
      discount = (applicableSubtotal * discountValue) / 100;
      // Apply max discount cap if set
      if (maxDiscount && discount > maxDiscount) {
        discount = maxDiscount;
      }
    } else {
      // FIXED amount
      discount = Math.min(discountValue, applicableSubtotal);
    }

    // Round to 2 decimal places
    discount = Math.round(discount * 100) / 100;

    console.log("[Coupon Validate] Final discount:", discount);

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        type: couponType,
        discountType: discountType,
        discountValue: discountValue,
        maxDiscount: maxDiscount,
        discount: discount,
        applicableSubtotal: applicableSubtotal,
      },
    });
  } catch (error) {
    console.error("[GET /api/coupons/validate] Unhandled error:", error);
    // Return more detailed error in development
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to validate coupon", details: errorMessage },
      { status: 500 }
    );
  }
}
