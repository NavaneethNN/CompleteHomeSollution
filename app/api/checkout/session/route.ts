import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createGuestOrderToken, createOrderReturnToken } from "@/lib/order-access";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { chargeToken, PayWayApiError } from "@/lib/payway";
import { activateMembershipInTransaction } from "@/lib/membership";
import { queueOrderConfirmation, queueRefundAction } from "@/lib/email-outbox";
import { sendOrderConfirmationSms, sendOrderWhatsApp } from "@/lib/twilio";
import { getEligibleShip123Products, getShip123Rates } from "@/lib/ship123";
import { createOnlinePayCheckout, getOnlinePayCheckout, OnlinePayCheckoutError, validateOnlinePayConfiguration } from "@/lib/onlinepay";
import { shippingDestinationKey, verifyShippingQuoteToken } from "@/lib/shipping-quote";
import { calculateCartPricing, moneyToCents, splitLineForGateway } from "@/lib/cart-pricing";
import { releaseCouponReservation } from "@/lib/coupon-reservation";
import { buildParcelGroups, FreightRequiredError, shipmentKey } from "@/lib/shipping-packages";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { assertInventoryAvailableForPendingOrder, InventoryUnavailableError } from "@/lib/inventory-reservation";
import { resolveMemberPrice } from "@/lib/member-price";
import { checkoutTotals } from "@/lib/checkout-totals";

const addressSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(1).max(40),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  suburb: z.string().trim().min(2).max(120),
  state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]),
  postcode: z.string().regex(/^\d{4}$/),
  country: z.literal("AU").default("AU"),
});

const checkoutSchema = z
  .object({
    /** Single-use token from PayWay Trusted Frame */
    // OnlinePay uses a hosted page and does not produce a PayWay token. Treat
    // an empty client value as absent rather than rejecting it before gateway
    // selection occurs.
    singleUseTokenId: z.preprocess(
      (value) => value === "" ? undefined : value,
      z.string().uuid("Invalid payment token").optional()
    ),
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
    guestEmail: z.string().trim().email().max(254).optional(),
    shippingRateCode: z.string().max(50).optional(),
    shippingCost: z.number().min(0).max(500).optional(),
    shippingQuoteToken: z.string().max(1024).optional(),
    couponCode: z.string().max(20).optional(),
    addMembership: z.boolean().optional(),
    /** REL-5: Client-generated UUID for idempotency. Same key on retries returns
     *  the existing order instead of creating a duplicate. A new key must be
     *  generated for each distinct Place Order attempt. */
    idempotencyKey: z.string().uuid(),
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
    const limit = await consumeRateLimit("checkout", `${getClientIp(req.headers)}:${session?.user?.id ?? "guest"}`, 12, 10 * 60);
    if (!limit.allowed) return rateLimitResponse(limit);
    if (Number(req.headers.get("content-length") ?? 0) > 32_768) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const input = checkoutSchema.parse(body);
    const useOnlinePay = (process.env.PAYMENT_GATEWAY ?? process.env.NEXT_PUBLIC_PAYMENT_GATEWAY) === "onlinepay";
    if (!useOnlinePay && !input.singleUseTokenId) {
      return NextResponse.json({ error: "Payment details are required." }, { status: 400 });
    }

    if (useOnlinePay) {
      validateOnlinePayConfiguration();
      const returnUrl = process.env.ONLINEPAY_RETURN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
      if (!returnUrl || !URL.canParse(returnUrl) || new URL(returnUrl).protocol !== "https:") {
        return NextResponse.json({ error: "OnlinePay requires HTTPS. Configure ONLINEPAY_RETURN_BASE_URL with your HTTPS app URL (https://localhost:3000 for local testing)." }, { status: 503 });
      }
      const returnOrigin = new URL(returnUrl);
      if (["localhost", "127.0.0.1", "[::1]"].includes(returnOrigin.hostname) && req.nextUrl.origin !== returnOrigin.origin) {
        return NextResponse.json({ error: "The payment return URL points to HTTPS localhost, but this site is running at a different address. Start npm run dev and open https://localhost:3000." }, { status: 503 });
      }
    }

    // A cart must have one line per product/variant. Besides producing clearer
    // order data, this prevents a duplicate client line from bypassing the
    // per-line stock check before payment is taken.
    const itemKeys = input.items.map((item) => `${item.productId}:${item.variantId ?? "base"}`);
    if (new Set(itemKeys).size !== itemKeys.length) {
      return NextResponse.json({ error: "Your cart contains duplicate items. Please refresh and try again." }, { status: 400 });
    }

    // ── REL-5: Idempotency check ──────────────────────────────────────────────
    // If the client sent an idempotencyKey and an order with that key already
    // exists, return the existing order's data immediately without creating a
    // duplicate. This handles browser retries, double-clicks, and network
    // hiccups where the first request succeeded but the response was lost.
    if (!session?.user?.id && !input.guestEmail) {
      return NextResponse.json({ error: "An email address is required." }, { status: 400 });
    }
    const replay = async () => {
      const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (!existing) return null;
      const ownerMatches = session?.user?.id
        ? existing.userId === session.user.id
        : !existing.userId && existing.guestEmail === input.guestEmail?.trim().toLowerCase();
      if (!ownerMatches) return NextResponse.json({ error: "Checkout key is already in use." }, { status: 409 });
      if (existing.status === "CANCELLED" || existing.status === "REFUNDED") {
        return NextResponse.json({ error: "This checkout is closed. Start a new checkout.", retryWithNewKey: true }, { status: 409 });
      }
      if (existing.status === "PENDING" && existing.paywayTransactionId?.startsWith("ONLINEPAY:")) {
        const checkout = await getOnlinePayCheckout(existing.paywayTransactionId.slice(10));
        if (typeof checkout.url === "string") {
          return NextResponse.json({ orderId: existing.id, guestToken: existing.guestEmail ? createGuestOrderToken(existing.id, existing.guestEmail) : undefined, status: "redirect", checkoutUrl: checkout.url });
        }
      }
      return NextResponse.json({ orderId: existing.id, guestToken: existing.guestEmail ? createGuestOrderToken(existing.id, existing.guestEmail) : undefined, status: existing.status === "PENDING" ? "pending" : "success", idempotent: true });
    };
    const previousResponse = await replay();
    if (previousResponse) return previousResponse;

    // ── Resolve address ──────────────────────────────────────────────────────
    let deliveryAddress: z.infer<typeof addressSchema>;
    if (input.savedAddressId) {
      if (!session?.user?.id) return NextResponse.json({ error: "Authentication required to use saved addresses" }, { status: 401 });
      const existing = await db.address.findFirst({ where: { id: input.savedAddressId, userId: session.user.id } });
      if (!existing) return NextResponse.json({ error: "Address not found" }, { status: 400 });
      const parsedAddress = addressSchema.safeParse({ name: existing.name, phone: existing.phone, line1: existing.line1, line2: existing.line2 ?? undefined, suburb: existing.suburb, state: existing.state, postcode: existing.postcode, country: "AU" });
      if (!parsedAddress.success) return NextResponse.json({ error: "Saved address needs updating before checkout." }, { status: 400 });
      deliveryAddress = parsedAddress.data;
    } else {
      deliveryAddress = input.address!;
    }

    // ── Fetch products and customer state ────────────────────────────────────
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const [products, currentUser] = await Promise.all([
      db.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        include: {
          productVariants: {
            where: { isActive: true },
            include: {
              values: {
                include: {
                  variantValue: {
                    include: {
                      variantAttribute: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      session?.user?.id
        ? db.user.findUnique({ where: { id: session.user.id }, select: { isMember: true, membershipExpiry: true } })
        : Promise.resolve(null),
    ]);

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "One or more products are unavailable." }, { status: 400 });
    }

    // Expired memberships must not receive member prices, free shipping, or
    // members-only coupons merely because a stale boolean is still set.
    const isMemberFromDb = !!currentUser?.isMember &&
      (!currentUser.membershipExpiry || currentUser.membershipExpiry > new Date());
    const wantsMembership = input.addMembership === true && !!session?.user?.id;
    const alreadyMember = isMemberFromDb;
    const effectiveMember = isMemberFromDb || (wantsMembership && !alreadyMember);
    const defaultPlan = wantsMembership && !alreadyMember
      ? await db.membershipPlan.findFirst({
          where: { isActive: true, isDefault: true },
          select: { id: true, price: true, durationDays: true },
        })
      : null;
    if (wantsMembership && !alreadyMember && !defaultPlan) {
      return NextResponse.json({ error: "Membership is currently unavailable." }, { status: 400 });
    }

    // ── Coupon validation ─────────────────────────────────────────────────────
    type CouponWithRelations = Awaited<ReturnType<typeof db.coupon.findUnique>> & {
      products: { productId: string }[];
      categories: { categoryId: string }[];
    };
    let coupon: CouponWithRelations | null = null;
    let couponDiscount = 0;
    const couponCode = input.couponCode?.trim().toUpperCase();

    if (couponCode) {
      coupon = await db.coupon.findUnique({
        where: { code: couponCode },
        include: {
          products: { select: { productId: true } },
          categories: { select: { categoryId: true } },
        },
      }) as CouponWithRelations | null;
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
        const userUsageCount = await db.userCoupon.count({
          where: { userId: session.user.id, couponId: coupon.id },
        });
        if (userUsageCount >= coupon.perUserLimit) {
          return NextResponse.json({ error: "Coupon usage limit reached for your account" }, { status: 400 });
        }
      }

      if (coupon.memberEligibility === "MEMBERS_ONLY" && !isMemberFromDb) {
        return NextResponse.json({ error: "This coupon is only available for members" }, { status: 400 });
      }
      if (coupon.memberEligibility === "NON_MEMBERS" && isMemberFromDb) {
        return NextResponse.json({ error: "This coupon is only available for non-members" }, { status: 400 });
      }

    }

    // ── Pricing ───────────────────────────────────────────────────────────────
    // Recalculate coupon discounts from the authoritative (including member)
    // prices. Crucially, PRODUCT and CATEGORY coupons only discount eligible
    // lines; they must not be spread across unrelated cart items.
    const applicableProductIds = new Set<string>(
      coupon?.type === "PRODUCT"
        ? coupon.products.map((p) => p.productId)
        : coupon?.type === "CATEGORY"
          ? products.filter((p) => coupon.categories.some((c) => c.categoryId === p.categoryId)).map((p) => p.id)
          : products.map((p) => p.id)
    );
    const getUnitPrice = (item: typeof input.items[number]) => {
      const product = products.find((p) => p.id === item.productId)!;
      const variant = item.variantId ? product.productVariants.find((v) => v.id === item.variantId) : null;
      const regularPrice = variant?.price ?? product.basePrice;
      const memberPrice = resolveMemberPrice(regularPrice, variant?.memberPrice, product.memberPrice);
      return effectiveMember && memberPrice !== null ? memberPrice : regularPrice;
    };
    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId)!;
      const stock = item.variantId
        ? product.productVariants.find((variant) => variant.id === item.variantId)?.stock
        : product.stock;
      if (stock == null) return NextResponse.json({ error: "Variant not found" }, { status: 400 });
      if (stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 400 });
      }
    }
    const priceLines = input.items.map((item) => ({
      key: `${item.productId}:${item.variantId ?? "base"}`,
      unitPriceCents: moneyToCents(getUnitPrice(item)),
      quantity: item.quantity,
      eligible: applicableProductIds.has(item.productId),
    }));
    const undiscounted = calculateCartPricing(priceLines);
    const applicableSubtotal = undiscounted.applicableSubtotalCents / 100;
    if (coupon) {
      if (applicableSubtotal <= 0) {
        return NextResponse.json({ error: "This coupon is not valid for the items in your cart" }, { status: 400 });
      }
      if (coupon.minOrderAmount && applicableSubtotal < coupon.minOrderAmount) {
        return NextResponse.json({ error: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required` }, { status: 400 });
      }
    }
    const pricing = calculateCartPricing(priceLines, coupon ? {
      type: coupon.discountType,
      value: coupon.discountValue,
      maxDiscount: coupon.maxDiscount,
    } : null);
    couponDiscount = pricing.discountCents / 100;
    const subtotal = pricing.subtotalCents / 100;

    const membershipCharge = wantsMembership && !alreadyMember ? defaultPlan!.price : 0;
    const freeShipping = effectiveMember || subtotal >= 1200;
    let parcelGroups;
    try {
      parcelGroups = buildParcelGroups(input.items.map(item => {
        const product = products.find(value => value.id === item.productId)!;
        const variant = item.variantId ? product.productVariants.find(value => value.id === item.variantId) : null;
        return {
          key: `${item.productId}:${item.variantId ?? "base"}`,
          quantity: item.quantity,
          weight: variant?.weight ?? product.weight,
          length: variant?.length ?? product.length,
          width: variant?.width ?? product.width,
          height: variant?.height ?? product.height,
        };
      }));
    } catch (error) {
      if (error instanceof FreightRequiredError) {
        return NextResponse.json({ error: error.message, freightRequired: true }, { status: 422 });
      }
      throw error;
    }
    const parcelShipmentKey = shipmentKey(parcelGroups);
    if (!freeShipping && (!input.shippingCost || input.shippingCost <= 0)) {
      return NextResponse.json(
        { error: "A shipping rate is required for this order" },
        { status: 400 }
      );
    }

    // ── SEC-4: Server-side shipping cost verification ─────────────────────────
    // A signed Ship123 quote is bound to the full destination and parcel set.
    // Without a valid token, fetch a fresh quote and require exact cents.
    let shippingCost: number;
    let shippingServiceCode: string | null = null;
    if (freeShipping) {
      try {
        const rates = await getShip123Rates(deliveryAddress, parcelGroups);
        if (!rates.length) throw new Error("No eligible shipping rate");
        shippingServiceCode = rates[0].serviceCode;
      } catch (error) {
        console.error("[checkout] No Ship123 service for free-shipping order", error);
        return NextResponse.json({ error: "Shipping is currently unavailable for this order. Please contact support." }, { status: 503 });
      }
      shippingCost = 0;
    } else {
      const toPostcode = deliveryAddress.postcode;

      let serverShippingCost: number | null = null;

      const clientCost = Math.round((input.shippingCost ?? 0) * 100) / 100;
      if (verifyShippingQuoteToken({
        token: input.shippingQuoteToken,
        postcode: toPostcode,
        destinationKey: shippingDestinationKey(deliveryAddress),
        shipmentKey: parcelShipmentKey,
        serviceCode: input.shippingRateCode,
        price: clientCost,
      })) {
        try {
          const eligible = await getEligibleShip123Products();
          if (eligible.some(product => product.code === input.shippingRateCode)) serverShippingCost = clientCost;
        } catch (error) {
          console.error("[checkout] Ship123 service eligibility check failed", error);
        }
      } else if (toPostcode && /^\d{4}$/.test(toPostcode) && input.shippingRateCode) {
        try {
          const rates = await getShip123Rates(deliveryAddress, parcelGroups);
          const matchedRate = rates.find((r) => r.serviceCode === input.shippingRateCode);
          if (matchedRate) {
            serverShippingCost = matchedRate.price;
          }
        } catch (ship123Error) {
          console.error("[checkout] Ship123 rate fetch failed", ship123Error);
        }
      }

      if (serverShippingCost !== null) {
        const serverCost = Math.round(serverShippingCost * 100) / 100;
        if (Math.round(clientCost * 100) !== Math.round(serverCost * 100)) {
          return NextResponse.json(
            {
              error: `Shipping cost mismatch. Expected $${serverCost.toFixed(2)}, received $${clientCost.toFixed(2)}. Please refresh and try again.`,
            },
            { status: 400 }
          );
        }
        shippingCost = serverCost;
        shippingServiceCode = input.shippingRateCode ?? null;
      } else {
        // Do not charge an unverified client-supplied shipping amount.
        return NextResponse.json({ error: "Shipping could not be verified. Refresh shipping options and try again." }, { status: 503 });
      }
    }
    const { tax, total } = checkoutTotals(subtotal, shippingCost, membershipCharge);

    // ── Create order in DB (PENDING until payment confirmed) ─────────────────
    let order;
    try {
      order = await db.$transaction(async (tx) => {
        if (coupon) {
          await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${coupon.id} FOR UPDATE`;
          const currentCoupon = await tx.coupon.findUnique({
            where: { id: coupon.id },
            select: { isActive: true, usageCount: true, usageLimit: true, perUserLimit: true },
          });
          if (!currentCoupon?.isActive ||
              (currentCoupon.usageLimit != null && currentCoupon.usageCount >= currentCoupon.usageLimit)) {
            throw new Error("COUPON_LIMIT");
          }
          if (currentCoupon.perUserLimit != null && session?.user?.id) {
            const uses = await tx.userCoupon.count({ where: { userId: session.user.id, couponId: coupon.id } });
            if (uses >= currentCoupon.perUserLimit) throw new Error("COUPON_USER_LIMIT");
          }
        }
        await assertInventoryAvailableForPendingOrder(tx, input.items);
        const createdOrder = await tx.order.create({
        data: {
        ...(session?.user?.id ? { user: { connect: { id: session.user.id } } } : {}),
        guestEmail: input.guestEmail?.trim().toLowerCase() || null,
        guestPhone: !session?.user?.id ? (input.address?.phone ?? null) : null,
        address: { create: deliveryAddress },
        subtotal,
        shippingCost,
        shippingServiceCode,
        tax,
        discount: couponDiscount,
        total,
        status: "PENDING",
        membershipAmount: membershipCharge,
        membershipPlanId: membershipCharge > 0 ? defaultPlan!.id : null,
        membershipDurationDays: membershipCharge > 0 ? defaultPlan!.durationDays : null,
        // REL-5: Store the idempotency key so retries can find this order
        idempotencyKey: input.idempotencyKey,
        couponReserved: !!coupon,
        ...(coupon ? { coupon: { connect: { id: coupon.id } }, couponCode: coupon.code } : {}),
        items: {
          create: input.items.map((item, index) => {
            // CODE-10: Populate variantSummary from variant values
            const product = products.find((p) => p.id === item.productId)!;
            const variant = item.variantId
              ? product.productVariants.find((v) => v.id === item.variantId)
              : null;
            
            let variantSummary: string | null = null;
            if (variant && variant.values && variant.values.length > 0) {
              // Build summary like "Color: Red, Size: Large"
              variantSummary = variant.values
                .map((v) => `${v.variantValue.variantAttribute.name}: ${v.variantValue.value}`)
                .join(", ");
            }

            return {
              productId: item.productId,
              productVariantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: pricing.lines[index].netCents / item.quantity / 100,
              variantSummary,
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
        if (coupon) {
          await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
          if (session?.user?.id) {
            await tx.userCoupon.create({
              data: { userId: session.user.id, couponId: coupon.id, orderId: createdOrder.id },
            });
          }
        }
        return createdOrder;
      });
    } catch (error) {
      // Two requests can both pass the initial lookup and race to insert the
      // same key. The unique constraint is the final idempotency guard.
      if (
        input.idempotencyKey &&
        typeof error === "object" && error !== null &&
        "code" in error && error.code === "P2002"
      ) {
        const response = await replay();
        if (response) return response;
      }
      if (error instanceof Error && ["COUPON_LIMIT", "COUPON_USER_LIMIT"].includes(error.message)) {
        return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 409 });
      }
      if (error instanceof InventoryUnavailableError) {
        const name = products.find(product => product.id === error.productId)?.name ?? "An item";
        return NextResponse.json({ error: `${name} is currently held by another checkout. Please try again shortly.` }, { status: 409 });
      }
      throw error;
    }

    // OnlinePay HPP keeps card data entirely on Westpac's hosted page. Orders
    // remain PENDING until a webhook or the signed return page verifies the
    // transaction server-to-server; the redirect itself is never payment proof.
    if (useOnlinePay) {
      let hostedCheckout: Awaited<ReturnType<typeof createOnlinePayCheckout>> | null = null;
      try {
        const appUrl = process.env.ONLINEPAY_RETURN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
          throw new Error("NEXT_PUBLIC_APP_URL must be configured for OnlinePay checkout.");
        }
        if (new URL(appUrl).protocol !== "https:") {
          throw new Error("OnlinePay requires an HTTPS return URL. Configure ONLINEPAY_RETURN_BASE_URL with your HTTPS application URL.");
        }
        const email = order.user?.email ?? order.guestEmail;
        if (!email) throw new Error("An email address is required for OnlinePay checkout.");
        const [firstName = "Customer", ...rest] = (order.address.name || "Customer").trim().split(/\s+/);
        const signedReturnUrl = `${appUrl.replace(/\/$/, "")}/order-confirmation/${order.id}?return_token=${createOrderReturnToken(order.id)}`;
        hostedCheckout = await createOnlinePayCheckout({
          amountCents: Math.round(order.total * 100),
          merchantReference: order.id,
          returnUrl: signedReturnUrl,
          shopUrl: signedReturnUrl,
          customer: {
            email, firstName, lastName: rest.join(" ") || "Customer", address1: order.address.line1,
            city: order.address.suburb, state: order.address.state, postcode: order.address.postcode,
          },
          lineItems: [
            ...pricing.lines.flatMap((line, index) => splitLineForGateway(line).map((part) => ({
              name: products.find((product) => product.id === input.items[index].productId)!.name,
              quantity: part.quantity,
              unitPriceCents: part.unitPriceCents,
            }))),
            ...[{ name: "Shipping", amount: order.shippingCost }, { name: "GST", amount: order.tax }, { name: "Membership", amount: membershipCharge }]
              .filter((item) => item.amount > 0).map((item) => ({ name: item.name, quantity: 1, unitPriceCents: Math.round(item.amount * 100) })),
          ],
        });
        await db.order.update({ where: { id: order.id }, data: { paywayTransactionId: `ONLINEPAY:${hostedCheckout.id}` } });
        return NextResponse.json({ orderId: order.id, guestToken: order.guestEmail ? createGuestOrderToken(order.id, order.guestEmail) : undefined, status: "redirect", checkoutUrl: hostedCheckout.url });
      } catch (error) {
        console.error("[checkout] OnlinePay checkout creation failed", error);
        if (error instanceof OnlinePayCheckoutError && error.definitelyRejected) {
          await db.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
          await releaseCouponReservation(order.id);
          return NextResponse.json({ error: error.message, retryWithNewKey: true }, { status: 422 });
        }
        if (hostedCheckout) {
          return NextResponse.json({
            orderId: order.id,
            guestToken: order.guestEmail ? createGuestOrderToken(order.id, order.guestEmail) : undefined,
            status: "redirect",
            checkoutUrl: hostedCheckout.url,
          });
        }
        return NextResponse.json({
          orderId: order.id,
          guestToken: order.guestEmail ? createGuestOrderToken(order.id, order.guestEmail) : undefined,
          status: "pending",
        });
      }
    }

    // ── Charge via PayWay ─────────────────────────────────────────────────────
    // Coupon allowance was reserved atomically with order creation. Confirmed
    // rejections release it; ambiguous outcomes retain it with the pending order.
    const customerIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    let txn;
    try {
      txn = await chargeToken({
        singleUseTokenId: input.singleUseTokenId!,
        idempotencyKey: input.idempotencyKey,
        orderNumber: order.id,
        principalAmount: total,
        customerIpAddress: customerIp,
      });
    } catch (err) {
      console.error("[checkout] PayWay charge failed", err);
      if (err instanceof PayWayApiError && err.httpStatus >= 400 && err.httpStatus < 500 && ![408, 409, 429].includes(err.httpStatus)) {
        await db.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
        await releaseCouponReservation(order.id);
        return NextResponse.json({ error: "Payment details were rejected. Please check them and try again.", retryWithNewKey: true }, { status: 422 });
      }
      // A timeout is ambiguous: never cancel or encourage another charge.
      return NextResponse.json({ orderId: order.id, guestToken: order.guestEmail ? createGuestOrderToken(order.id, order.guestEmail) : undefined, status: "pending" });
    }

    // Record the provider transaction as soon as it exists. If a subsequent
    // database operation or the HTTP response fails, the idempotent retry and
    // pending-payment poll can still recover this already-authorised payment.
    await db.order.update({
      where: { id: order.id },
      data: { paywayTransactionId: String(txn.transactionId) },
    });

    // ── Handle PayWay transaction status ──────────────────────────────────────
    if (txn.status === "declined" || txn.status === "suspended" || txn.status === "voided") {
      await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      await releaseCouponReservation(order.id);
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
      guestToken: order.guestEmail ? createGuestOrderToken(order.id, order.guestEmail) : undefined,
        transactionId: txn.transactionId,
        status: "pending",
      });
    }

    if (txn.status !== "approved" && txn.status !== "approved*") {
      return NextResponse.json({ orderId: order.id, guestToken: order.guestEmail ? createGuestOrderToken(order.id, order.guestEmail) : undefined, status: "pending" });
    }

    // status === "approved" | "approved*" — complete order atomically
    //
    // Coupon allowance is already reserved, so settlement only converts that
    // reservation into durable usage by clearing couponReserved.
    //
    // REL-1 fix: Stock is decremented with a WHERE stock >= quantity guard using
    // updateMany. If another concurrent order already took the last unit between
    // our pre-payment stock check and now, updateMany returns count === 0 and we
    // throw, rolling back the entire transaction. The order is then cancelled so
    // the customer receives a clear "out of stock" error rather than a silent
    // oversell.
    try {
      const settled = await db.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "PAID" } });
        if (!claimed.count) return false;
        // ── REL-1: Atomic stock decrement with oversell guard ─────────────────
        for (const item of order.items) {
          if (item.productVariantId) {
            const updated = await tx.productVariant.updateMany({
              where: {
                id: item.productVariantId,
                stock: { gte: item.quantity }, // guard: only decrement if enough stock remains
              },
              data: { stock: { decrement: item.quantity } },
            });
            if (updated.count === 0) {
              // Find the product name for a clear error message
              const variant = await tx.productVariant.findUnique({
                where: { id: item.productVariantId },
                select: { product: { select: { name: true } } },
              });
              throw new Error(`OUT_OF_STOCK:${variant?.product.name ?? "A product"}`);
            }
          } else {
            const updated = await tx.product.updateMany({
              where: {
                id: item.productId,
                stock: { gte: item.quantity }, // guard: only decrement if enough stock remains
              },
              data: { stock: { decrement: item.quantity } },
            });
            if (updated.count === 0) {
              const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { name: true },
              });
              throw new Error(`OUT_OF_STOCK:${product?.name ?? "A product"}`);
            }
          }
        }

        // ── Mark order as PAID with PayWay transaction ID ─────────────────────
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            paywayTransactionId: String(txn.transactionId),
            couponReserved: false,
          },
        });
        await queueOrderConfirmation(tx, order.id);
        if (order.membershipAmount > 0 && order.userId) {
          await activateMembershipInTransaction(tx, { userId: order.userId, planId: order.membershipPlanId, durationDays: order.membershipDurationDays ?? undefined, amountPaid: order.membershipAmount, paywaySessionId: `order:${order.id}:membership` });
        }
        return true;
      });
      if (!settled) return NextResponse.json({ orderId: order.id, guestToken: order.guestEmail ? createGuestOrderToken(order.id, order.guestEmail) : undefined, status: "pending" });
    } catch (txErr) {
      const message = txErr instanceof Error ? txErr.message : "";
      if (message.startsWith("OUT_OF_STOCK:")) {
        const productName = message.replace("OUT_OF_STOCK:", "");
        // Payment was taken but we cannot fulfil — cancel order and flag for ops
        await db.$transaction(async tx => {
          const changed = await tx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: "CANCELLED", refundRequested: true, refundReason: "Payment approved but stock unavailable; refund required" },
          });
          if (changed.count) await queueRefundAction(tx, order.id);
        });
        console.error(
          `[checkout] Stock exhausted post-payment for "${productName}". ` +
            `Order ${order.id} cancelled. PayWay txn ${txn.transactionId} needs manual refund.`
        );
        // Return a specific error so the client can show a meaningful message
        return NextResponse.json(
          {
            error: `Sorry, "${productName}" just sold out. Payment was approved; please contact support for a refund.`,
            status: "out_of_stock",
          },
          { status: 409 }
        );
      }
      // Unexpected transaction error
      console.error("[checkout] Post-payment transaction failed", txErr);
      return NextResponse.json(
        { error: "Order could not be completed. Please contact support." },
        { status: 500 }
      );
    }

    // ── Send confirmation notifications ───────────────────────────────────────
    const phone = order.user?.phone ?? order.guestPhone;

    after(async () => {
    if (phone) {
      await sendOrderConfirmationSms(phone, order.id, order.total).catch(() => {});
      await sendOrderWhatsApp(phone, order.id, order.total).catch(() => {});
    }

    });

    return NextResponse.json({
      orderId: order.id,
      guestToken: order.guestEmail ? createGuestOrderToken(order.id, order.guestEmail) : undefined,
      receiptNumber: txn.receiptNumber,
      transactionId: txn.transactionId,
      status: "success",
    });
  } catch (error) {
    console.error("[POST /api/checkout/session]", error);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2022") {
      return NextResponse.json({ error: "Checkout is temporarily unavailable while the database is updated. Please check your order before retrying." }, { status: 503 });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to process payment. Please try again." },
      { status: 500 }
    );
  }
}
