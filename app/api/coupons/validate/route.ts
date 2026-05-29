import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const validateSchema = z.object({
  code: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string().optional(),
      quantity: z.number().int().positive(),
      price: z.number().nonnegative(), // Current price (member price if applicable)
    })
  ),
  userId: z.string().optional(),
  subtotal: z.number().nonnegative(), // Current subtotal before coupon
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const itemsJson = searchParams.get("items");
    const subtotal = parseFloat(searchParams.get("subtotal") || "0");

    if (!code) {
      return NextResponse.json({ error: "Coupon code required" }, { status: 400 });
    }

    let items: any[] = [];
    if (itemsJson) {
      try {
        items = JSON.parse(itemsJson);
      } catch {
        return NextResponse.json({ error: "Invalid items format" }, { status: 400 });
      }
    }

    // Find the coupon
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = await (db as any).coupon.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
      },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 404 });
    }

    if (!coupon.isActive) {
      return NextResponse.json({ error: "This coupon is no longer active" }, { status: 400 });
    }

    // Check date validity
    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      return NextResponse.json({ error: "This coupon is not yet valid" }, { status: 400 });
    }
    if (coupon.endDate && now > coupon.endDate) {
      return NextResponse.json({ error: "This coupon has expired" }, { status: 400 });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return NextResponse.json({ error: "This coupon has reached its usage limit" }, { status: 400 });
    }

    // Check per-user limit (requires authentication)
    const userId = searchParams.get("userId");
    if (coupon.perUserLimit && userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userUsageCount = await (db as any).userCoupon.count({
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
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return NextResponse.json(
        { error: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required` },
        { status: 400 }
      );
    }

    // Calculate discount based on coupon type
    let applicableSubtotal = subtotal;
    let discount = 0;

    if (coupon.type === "PRODUCT") {
      // Only apply to specific products
      const applicableProductIds = coupon.products.map((p: any) => p.productId);
      applicableSubtotal = items
        .filter((item) => applicableProductIds.includes(item.productId))
        .reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      if (applicableSubtotal === 0) {
        return NextResponse.json(
          { error: "This coupon is not valid for the items in your cart" },
          { status: 400 }
        );
      }
    } else if (coupon.type === "CATEGORY") {
      // Need to fetch product categories
      const applicableCategoryIds = coupon.categories.map((c: any) => c.categoryId);
      const productIds = items.map((i) => i.productId);
      
      const products = await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, categoryId: true },
      });

      applicableSubtotal = items
        .filter((item: any) => {
          const product = products.find((p: any) => p.id === item.productId);
          return product && applicableCategoryIds.includes(product.categoryId);
        })
        .reduce((sum, item) => sum + item.price * item.quantity, 0);

      if (applicableSubtotal === 0) {
        return NextResponse.json(
          { error: "This coupon is not valid for the items in your cart" },
          { status: 400 }
        );
      }
    }

    // Calculate discount
    if (coupon.discountType === "PERCENTAGE") {
      discount = (applicableSubtotal * coupon.discountValue) / 100;
      // Apply max discount cap if set
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      // FIXED amount
      discount = Math.min(coupon.discountValue, applicableSubtotal);
    }

    // Round to 2 decimal places
    discount = Math.round(discount * 100) / 100;

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
        discount: discount,
        applicableSubtotal: applicableSubtotal,
      },
    });
  } catch (error) {
    console.error("[GET /api/coupons/validate]", error);
    return NextResponse.json({ error: "Failed to validate coupon" }, { status: 500 });
  }
}
