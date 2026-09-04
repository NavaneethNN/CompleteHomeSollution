import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { chargeToken, PayWayApiError } from "@/lib/payway";
import { activateMembership } from "@/lib/membership";
import { sendOrderConfirmationEmail } from "@/lib/brevo";
import { sendOrderConfirmationSms, sendOrderWhatsApp } from "@/lib/twilio";

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

const checkoutSchema = z
  .object({
    /** Single-use token from PayWay Trusted Frame */
    singleUseTokenId: z.string().uuid("Invalid payment token"),
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

    // ── Resolve address ──────────────────────────────────────────────────────
    let addressId: string;
    if (input.savedAddressId) {
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Authentication required to use saved addresses" },
          { status: 401 }
        );
      }
      const existing = await db.address.findFirst({
        where: { id: input.savedAddressId, userId: session.user.id },
      });
      if (!existing) return NextResponse.json({ error: "Address not found" }, { status: 400 });
      addressId = existing.id;
    } else {
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

    // ── Fetch products ────────────────────────────────────────────────────────
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { productVariants: { where: { isActive: true } } },
    });

    // ── Coupon validation ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let coupon: any = null;
    let couponDiscount = 0;
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
      const now = new Date();
      if (coupon.startDate && now < new Date(coupon.startDate)) {
        return NextResponse.json({ error: "Coupon not yet valid" }, { status: 400 });
      }
      if (coupon.endDate && now > new Date(coupon.endDate)) {
        return NextResponse.json({ error: "Coupon expired" }, { status: 400 });
      }
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
      }
      if (coupon.perUserLimit && session?.user?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userUsageCount = await (db as any).userCoupon.count({
          where: { userId: session.user.id, couponId: coupon.id },
        });
        if (userUsageCount >= coupon.perUserLimit) {
          return NextResponse.json({ error: "Coupon usage limit reached for your account" }, { status: 400 });
        }
      }

      // Calculate discount
      let applicableSubtotal = 0;
      if (coupon.type === "PRODUCT") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const applicableProductIds = coupon.products.map((p: any) => p.productId);
        applicableSubtotal = input.items
          .filter((item) => applicableProductIds.includes(item.productId))
          .reduce((sum, item) => {
            const product = products.find((p) => p.id === item.productId);
            let unitPrice = product?.basePrice ?? 0;
            if (item.variantId && product?.productVariants) {
              const v = product.productVariants.find((v) => v.id === item.variantId);
              unitPrice = v?.price ?? unitPrice;
            }
            return sum + unitPrice * item.quantity;
          }, 0);
      } else if (coupon.type === "CATEGORY") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const applicableCategoryIds = coupon.categories.map((c: any) => c.categoryId);
        const productsWithCats = await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, categoryId: true },
        });
        const applicableProductIds = productsWithCats
          .filter((p) => applicableCategoryIds.includes(p.categoryId))
          .map((p) => p.id);
        applicableSubtotal = input.items
          .filter((item) => applicableProductIds.includes(item.productId))
          .reduce((sum, item) => {
            const product = products.find((p) => p.id === item.productId);
            let unitPrice = product?.basePrice ?? 0;
            if (item.variantId && product?.productVariants) {
              const v = product.productVariants.find((v) => v.id === item.variantId);
              unitPrice = v?.price ?? unitPrice;
            }
            return sum + unitPrice * item.quantity;
          }, 0);
      } else {
        applicableSubtotal = input.items.reduce((sum, item) => {
          const product = products.find((p) => p.id === item.productId);
          let unitPrice = product?.basePrice ?? 0;
          if (item.variantId && product?.productVariants) {
            const v = product.productVariants.find((v) => v.id === item.variantId);
            unitPrice = v?.price ?? unitPrice;
          }
          return sum + unitPrice * item.quantity;
        }, 0);
      }
      if (coupon.minOrderAmount && applicableSubtotal < coupon.minOrderAmount) {
        return NextResponse.json(
          { error: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required` },
          { status: 400 }
        );
      }
      if (coupon.discountType === "PERCENTAGE") {
        couponDiscount = (applicableSubtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
          couponDiscount = coupon.maxDiscount;
        }
      } else {
        couponDiscount = Math.min(coupon.discountValue, applicableSubtotal);
      }
      couponDiscount = Math.round(couponDiscount * 100) / 100;
    }

    // ── Pricing ───────────────────────────────────────────────────────────────
    // Always fetch isMember from DB — never trust JWT for financial decisions
    let isMemberFromDb = false;
    if (session?.user?.id) {
      const currentUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { isMember: true },
      });
      isMemberFromDb = currentUser?.isMember ?? false;
    }

    const wantsMembership = input.addMembership === true && !!session?.user?.id;
    const alreadyMember = isMemberFromDb;
    const effectiveMember = isMemberFromDb || (wantsMembership && !alreadyMember);

    const totalBeforeDiscount = input.items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      let unitPrice = product?.basePrice ?? 0;
      if (item.variantId && product?.productVariants) {
        const v = product.productVariants.find((v) => v.id === item.variantId);
        unitPrice = v?.price ?? unitPrice;
      }
      return sum + unitPrice * item.quantity;
    }, 0);
    const discountFactor =
      couponDiscount > 0 && totalBeforeDiscount > 0
        ? (totalBeforeDiscount - couponDiscount) / totalBeforeDiscount
        : 1;

    let subtotal = 0;
    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 400 });
      }
      let unitPrice: number;
      if (item.variantId) {
        const variant = product.productVariants.find((v) => v.id === item.variantId);
        if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 400 });
        if (variant.stock < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${product.name}` },
            { status: 400 }
          );
        }
        unitPrice =
          effectiveMember && variant.memberPrice ? variant.memberPrice : variant.price;
      } else {
        if (product.stock < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${product.name}` },
            { status: 400 }
          );
        }
        unitPrice =
          effectiveMember && product.memberPrice ? product.memberPrice : product.basePrice;
      }
      subtotal += Math.round(unitPrice * discountFactor * 100) / 100 * item.quantity;
    }
    subtotal = Math.round(subtotal * 100) / 100;

    const membershipCharge = wantsMembership && !alreadyMember ? 30 : 0;
    const freeShipping = effectiveMember || subtotal >= 1200;
    if (!freeShipping && (!input.shippingCost || input.shippingCost <= 0)) {
      return NextResponse.json(
        { error: "A shipping rate is required for this order" },
        { status: 400 }
      );
    }
    const shippingCost = freeShipping ? 0 : Math.round(input.shippingCost! * 100) / 100;
    const tax = Math.round(subtotal * 0.1 * 100) / 100;
    const total = Math.round((subtotal + shippingCost + tax + membershipCharge) * 100) / 100;

    // ── Create order in DB (PENDING until payment confirmed) ─────────────────
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
        ...(coupon ? { couponId: coupon.id, couponCode: coupon.code } : {}),
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
      include: {
        items: { include: { product: { select: { name: true } } } },
        address: true,
        user: { select: { email: true, name: true, phone: true } },
      },
    });

    // ── Atomically claim coupon usage ─────────────────────────────────────────
    if (coupon) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).$transaction(async (tx: any) => {
        if (coupon.usageLimit != null) {
          const updated = await tx.coupon.updateMany({
            where: { id: coupon.id, isActive: true, usageCount: { lt: coupon.usageLimit } },
            data: { usageCount: { increment: 1 } },
          });
          if (updated.count === 0) throw new Error("Coupon usage limit reached");
        } else {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usageCount: { increment: 1 } },
          });
        }
        if (session?.user?.id) {
          await tx.userCoupon.create({
            data: { userId: session.user.id, couponId: coupon.id, orderId: order.id },
          });
        }
      });
    }

    // ── Charge via PayWay ─────────────────────────────────────────────────────
    const customerIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    let txn;
    try {
      txn = await chargeToken({
        singleUseTokenId: input.singleUseTokenId,
        orderNumber: order.id,
        principalAmount: total,
        customerIpAddress: customerIp,
      });
    } catch (err) {
      // Charge failed at network/API level — cancel order
      await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      console.error("[checkout] PayWay charge failed", err);
      const userMessage =
        err instanceof PayWayApiError
          ? (err.errors[0]?.message ?? err.message)
          : "Payment failed. Please try again.";
      return NextResponse.json({ error: userMessage }, { status: 422 });
    }

    // ── Handle PayWay transaction status ──────────────────────────────────────
    if (txn.status === "declined" || txn.status === "suspended") {
      await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      return NextResponse.json(
        {
          error: txn.responseText || "Payment declined. Please check your card details.",
          status: "declined",
          responseCode: txn.responseCode,
        },
        { status: 402 }
      );
    }

    if (txn.status === "pending") {
      // Async payment — leave as PENDING; client can poll GET /api/orders/:id
      return NextResponse.json({
        orderId: order.id,
        transactionId: txn.transactionId,
        status: "pending",
      });
    }

    // status === "approved" | "approved*" — complete order atomically
    await db.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productVariantId) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paywayTransactionId: String(txn.transactionId),
        },
      });
    });

    // ── Activate membership add-on ────────────────────────────────────────────
    if (wantsMembership && !alreadyMember && session?.user?.id) {
      const defaultPlan = await db.membershipPlan.findFirst({
        where: { isActive: true, isDefault: true },
        select: { price: true },
      });
      await activateMembership({
        userId: session.user.id,
        paywaySessionId: `${txn.transactionId}-membership`,
        amountPaid: defaultPlan?.price ?? 30,
      });
    }

    // ── Send confirmation notifications ───────────────────────────────────────
    const email = order.user?.email ?? order.guestEmail;
    const name = order.user?.name ?? "Customer";
    const phone = order.user?.phone ?? order.guestPhone;

    if (email) {
      sendOrderConfirmationEmail({
        email,
        name,
        orderId: order.id,
        total: order.total,
        items: order.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          price: i.unitPrice,
        })),
        address: order.address ?? null,
        customerEmail: email,
      }).catch((e) => console.error("Email send failed", e));
    }
    if (phone) {
      sendOrderConfirmationSms(phone, order.id, order.total).catch(() => {});
      sendOrderWhatsApp(phone, order.id, order.total).catch(() => {});
    }

    return NextResponse.json({
      orderId: order.id,
      receiptNumber: txn.receiptNumber,
      transactionId: txn.transactionId,
      status: "success",
    });
  } catch (error) {
    console.error("[POST /api/checkout/session]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to process payment. Please try again." },
      { status: 500 }
    );
  }
}
