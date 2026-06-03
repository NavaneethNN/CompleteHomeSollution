import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { createCheckoutSession } from "@/lib/stripe";

const addressSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(1),
  line1: z.string().min(3),
  line2: z.string().optional(),
  suburb: z.string().min(2),
  state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]),
  postcode: z.string().length(4),
  country: z.string().default("AU"),
});

// VALID_COUPONS removed - using database coupons now

const checkoutSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().cuid(),
          variantId: z.string().cuid().optional(),
          quantity: z.number().int().positive().max(100),
        })
      )
      .min(1, "Cart cannot be empty")
      .max(50, "Too many items in cart"),
    // address is only required when savedAddressId is not provided
    address: addressSchema.optional(),
    savedAddressId: z.string().cuid().optional(),
    guestEmail: z.string().email().optional(),
    shippingRateCode: z.string().max(50).optional(),
    shippingCost: z.number().min(0).max(500).optional(),
    couponCode: z.string().max(20).optional(),
    addMembership: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.savedAddressId && !data.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Address is required",
        path: ["address"],
      });
    }
  });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const input = checkoutSchema.parse(body);

    // Resolve address: use saved address or create new one
    let addressId: string;

    if (input.savedAddressId) {
      // Security: saved addresses require authentication
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Authentication required to use saved addresses" }, { status: 401 });
      }
      // Verify the saved address belongs to user
      const existing = await db.address.findFirst({
        where: { id: input.savedAddressId, userId: session.user.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Address not found" }, { status: 400 });
      }
      addressId = existing.id;
    } else {
      // Create new address (superRefine guarantees input.address is defined here)
      const addr = input.address!;
      const address = await db.address.create({
        data: {
          ...(session?.user?.id ? { userId: session.user.id } : {}),
          name: addr.name,
          phone: addr.phone,
          line1: addr.line1,
          line2: addr.line2 || null,
          suburb: addr.suburb,
          state: addr.state,
          postcode: addr.postcode,
          country: addr.country || "AU",
        },
      });
      addressId = address.id;
    }

    // Fetch products early - needed for both coupon validation and line items
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { productVariants: { where: { isActive: true } } },
    });

    // Validate coupon server-side from database
    let coupon: any = null;
    let couponDiscount = 0;
    let applicableSubtotal = 0;

    const couponCode = input.couponCode?.trim().toUpperCase();

    if (couponCode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      coupon = await (db as any).coupon.findUnique({
        where: { code: couponCode },
        include: {
          products: { select: { productId: true } },
          categories: { select: { categoryId: true } },
        },
      });

      if (!coupon || !coupon.isActive) {
        return NextResponse.json({ error: "Invalid or inactive coupon" }, { status: 400 });
      }

      // Check date validity
      const now = new Date();
      if (coupon.startDate && now < new Date(coupon.startDate)) {
        return NextResponse.json({ error: "Coupon not yet valid" }, { status: 400 });
      }
      if (coupon.endDate && now > new Date(coupon.endDate)) {
        return NextResponse.json({ error: "Coupon expired" }, { status: 400 });
      }

      // Check usage limit
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
      }

      // Check per-user limit (only for authenticated users)
      if (coupon.perUserLimit && session?.user?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userUsageCount = await (db as any).userCoupon.count({
          where: {
            userId: session.user.id,
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

      // Calculate applicable subtotal based on coupon type
      if (coupon.type === "PRODUCT") {
        const applicableProductIds = coupon.products.map((p: any) => p.productId);
        applicableSubtotal = input.items
          .filter((item) => applicableProductIds.includes(item.productId))
          .reduce((sum, item) => {
            const product = products.find((p) => p.id === item.productId);
            let unitPrice = product?.basePrice ?? 0;
            if (item.variantId && product?.productVariants) {
              const variant = product.productVariants.find((v) => v.id === item.variantId);
              unitPrice = variant?.price ?? unitPrice;
            }
            return sum + unitPrice * item.quantity;
          }, 0);
      } else if (coupon.type === "CATEGORY") {
        const applicableCategoryIds = coupon.categories.map((c: any) => c.categoryId);
        const productIds = [...new Set(input.items.map((i) => i.productId))];
        const productsWithCategories = await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, categoryId: true },
        });
        const applicableProductIds = productsWithCategories
          .filter((p) => applicableCategoryIds.includes(p.categoryId))
          .map((p) => p.id);

        applicableSubtotal = input.items
          .filter((item) => applicableProductIds.includes(item.productId))
          .reduce((sum, item) => {
            const product = products.find((p) => p.id === item.productId);
            let unitPrice = product?.basePrice ?? 0;
            if (item.variantId && product?.productVariants) {
              const variant = product.productVariants.find((v) => v.id === item.variantId);
              unitPrice = variant?.price ?? unitPrice;
            }
            return sum + unitPrice * item.quantity;
          }, 0);
      } else {
        // GLOBAL - apply to all items
        applicableSubtotal = input.items.reduce((sum, item) => {
          const product = products.find((p) => p.id === item.productId);
          let unitPrice = product?.basePrice ?? 0;
          if (item.variantId && product?.productVariants) {
            const variant = product.productVariants.find((v) => v.id === item.variantId);
            unitPrice = variant?.price ?? unitPrice;
          }
          return sum + unitPrice * item.quantity;
        }, 0);
      }

      // Check minimum order amount
      if (coupon.minOrderAmount && applicableSubtotal < coupon.minOrderAmount) {
        return NextResponse.json(
          { error: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required for this coupon` },
          { status: 400 }
        );
      }

      // Calculate discount
      if (coupon.discountType === "PERCENTAGE") {
        couponDiscount = (applicableSubtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
          couponDiscount = coupon.maxDiscount;
        }
      } else {
        // FIXED
        couponDiscount = Math.min(coupon.discountValue, applicableSubtotal);
      }

      couponDiscount = Math.round(couponDiscount * 100) / 100;
    }

    // For per-item discount factor (if we need to distribute discount across items)
    const totalBeforeDiscount = input.items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      let unitPrice = product?.basePrice ?? 0;
      if (item.variantId && product?.productVariants) {
        const variant = product.productVariants.find((v) => v.id === item.variantId);
        unitPrice = variant?.price ?? unitPrice;
      }
      return sum + unitPrice * item.quantity;
    }, 0);

    const discountFactor = couponDiscount > 0 && totalBeforeDiscount > 0
      ? (totalBeforeDiscount - couponDiscount) / totalBeforeDiscount
      : 1;

    // FIX: Always fetch isMember fresh from DB for billing — never trust JWT for financial decisions
    let isMemberFromDb = false;
    if (session?.user?.id) {
      const currentUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { isMember: true },
      });
      isMemberFromDb = currentUser?.isMember ?? false;
    }

    let subtotal = 0;
    const lineItems: {
      price_data: { currency: string; product_data: { name: string }; unit_amount: number };
      quantity: number;
    }[] = [];

    // Treat as member if already a member (fresh from DB) OR buying membership with this order
    const effectiveMember = isMemberFromDb || (input.addMembership === true && !!session?.user?.id);

    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found` },
          { status: 400 }
        );
      }

      let unitPrice: number;
      const itemName = product.name;

      if (item.variantId) {
        const variant = product.productVariants.find((v) => v.id === item.variantId);
        if (!variant) {
          return NextResponse.json({ error: `Variant not found` }, { status: 400 });
        }
        if (variant.stock < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${product.name}` },
            { status: 400 }
          );
        }
        unitPrice =
          effectiveMember && variant.memberPrice
            ? variant.memberPrice
            : variant.price;
      } else {
        if (product.stock < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${product.name}` },
            { status: 400 }
          );
        }
        unitPrice =
          effectiveMember && product.memberPrice
            ? product.memberPrice
            : product.basePrice;
      }

      // Apply coupon discount factor (distributes discount proportionally across items)
      const discountedUnitPrice = Math.round(unitPrice * discountFactor * 100) / 100;
      subtotal += discountedUnitPrice * item.quantity;
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: { name: itemName },
          unit_amount: Math.round(discountedUnitPrice * 100),
        },
        quantity: item.quantity,
      });
    }

    // Membership add-on: only allowed for authenticated non-members
    // Use isMemberFromDb (fresh) — no second DB call needed
    const wantsMembership = input.addMembership === true && !!session?.user?.id;
    const alreadyMember = isMemberFromDb;
    if (wantsMembership && !alreadyMember) {
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: { name: "CHS Premium Membership (Annual)" },
          unit_amount: 3000, // $30 AUD in cents
        },
        quantity: 1,
      });
    }
    const membershipCharge = (wantsMembership && !alreadyMember) ? 30 : 0;

    // FIX: Round subtotal to 2dp before computing tax/total (avoids float accumulation)
    // NOTE: Coupon discount is already applied to line items via discountFactor
    subtotal = Math.round(subtotal * 100) / 100;

    // Calculate totals — members always get free shipping; otherwise use AusPost rate
    const freeShipping = effectiveMember || subtotal >= 1200;

    // FIX: Reject non-free orders that send shippingCost=0 — prevents shipping fee bypass
    if (!freeShipping && (!input.shippingCost || input.shippingCost <= 0)) {
      return NextResponse.json(
        { error: "A shipping rate is required for this order" },
        { status: 400 }
      );
    }
    const shippingCost = freeShipping ? 0 : Math.round(input.shippingCost! * 100) / 100;

    const tax = Math.round(subtotal * 0.1 * 100) / 100; // 10% GST on discounted amount
    // FIX: Round total to 2dp so DB value matches Stripe integer-cent charge
    const total = Math.round((subtotal + shippingCost + tax + membershipCharge) * 100) / 100;

    // Add shipping as line item if not free
    if (shippingCost > 0) {
      const shippingLabel = input.shippingRateCode
        ? `Shipping (${input.shippingRateCode})`
        : "Shipping";
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: { name: shippingLabel },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    // Add tax as line item
    if (tax > 0) {
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: { name: "GST (10%)" },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    // Create the order in DB — store coupon and addMembership flag
    const order = await db.order.create({
      data: {
        ...(session?.user?.id ? { userId: session.user.id } : {}),
        guestEmail: input.guestEmail || null,
        guestPhone: !session?.user?.id ? (input.address?.phone ?? null) : null,
        addressId,
        subtotal,
        shippingCost,
        tax,
        discount: couponDiscount,
        total,
        status: "PENDING",
        ...(coupon ? {
          couponId: coupon.id,
          couponCode: coupon.code,
        } : {}),
        items: {
          create: input.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            let unitPrice: number;
            if (item.variantId) {
              const variant = product.productVariants.find((v) => v.id === item.variantId);
              unitPrice =
                effectiveMember && variant?.memberPrice
                  ? variant.memberPrice
                  : variant?.price || product.basePrice;
            } else {
              unitPrice =
                effectiveMember && product.memberPrice
                  ? product.memberPrice
                  : product.basePrice;
            }
            return {
              productId: item.productId,
              productVariantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: Math.round(unitPrice * discountFactor * 100) / 100,
            };
          }),
        },
      },
    });

    // Increment coupon usage count and track per-user usage
    if (coupon) {
      // Use transaction to prevent race conditions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).$transaction(async (tx: any) => {
        // Increment total usage count
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });

        // Track per-user usage (only for authenticated users)
        if (session?.user?.id) {
          await tx.userCoupon.create({
            data: {
              userId: session.user.id,
              couponId: coupon.id,
              orderId: order.id,
            },
          });
        }
      });
    }

    // Determine customer email
    const customerEmail =
      session?.user?.email || input.guestEmail || undefined;

    // Security: use server-configured URL, never trust client-supplied origin header
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
    const checkoutSession = await createCheckoutSession({
      lineItems,
      orderId: order.id,
      customerEmail,
      successUrl: `${appUrl}/order-confirmation/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/checkout?cancelled=true`,
      addMembership: wantsMembership,
      userId: session?.user?.id,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      orderId: order.id,
    });
  } catch (error) {
    console.error("[POST /api/checkout/session]", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create checkout session. Please try again." },
      { status: 500 }
    );
  }
}
