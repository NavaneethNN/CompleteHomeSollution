import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createOnlinePayCheckout, validateOnlinePayConfiguration, OnlinePayCheckoutError } from "@/lib/onlinepay";
import { createOrderReturnToken } from "@/lib/order-access";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const bodySchema = z.object({
  planId: z.string().cuid().optional(),
  address: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(1).max(30),
    line1: z.string().trim().min(3).max(120, "Billing address must be 120 characters or fewer."),
    suburb: z.string().trim().min(2).max(100),
    state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]),
    postcode: z.string().regex(/^\d{4}$/),
  }),
});

export async function POST(req: NextRequest) {
  let createdOrderId: string | undefined;
  let stage = "configuration";
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const limit = await consumeRateLimit("membership-checkout", `${getClientIp(req.headers)}:${session.user.id}`, 30, 10 * 60);
    if (!limit.allowed) return rateLimitResponse(limit);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    if ((process.env.PAYMENT_GATEWAY ?? process.env.NEXT_PUBLIC_PAYMENT_GATEWAY) !== "onlinepay") {
      return NextResponse.json({ error: "OnlinePay membership checkout is unavailable." }, { status: 503 });
    }
    const appUrl = process.env.ONLINEPAY_RETURN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl || !URL.canParse(appUrl) || new URL(appUrl).protocol !== "https:") {
      return NextResponse.json({ error: "Secure payment checkout is not configured." }, { status: 503 });
    }
    const returnOrigin = new URL(appUrl);
    if (["localhost", "127.0.0.1", "[::1]"].includes(returnOrigin.hostname) && req.nextUrl.origin !== returnOrigin.origin) {
      return NextResponse.json({ error: "The payment return URL points to HTTPS localhost, but this site is running at a different address. Start npm run dev and open https://localhost:3000." }, { status: 503 });
    }
    validateOnlinePayConfiguration();
    if (!(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)) {
      return NextResponse.json({ error: "Secure payment checkout is not configured." }, { status: 503 });
    }
    const { planId, address } = parsed.data;
    const plan = planId
      ? await db.membershipPlan.findFirst({ where: { id: planId, isActive: true } })
      : await db.membershipPlan.findFirst({ where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { price: "asc" }] });
    if (!plan || !Number.isFinite(plan.price) || plan.price <= 0 || plan.durationDays <= 0) {
      return NextResponse.json({ error: "Membership plan is unavailable." }, { status: 404 });
    }
    const userId = session.user.id;
    stage = "create-order";
    const result = await db.$transaction(async (tx) => {
      // One outstanding membership checkout per account, even across browser tabs.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.isMember && (!user.membershipExpiry || user.membershipExpiry > new Date())) return null;
      const existing = await tx.order.findFirst({
        where: { userId, status: "PENDING", membershipAmount: { gt: 0 } }, orderBy: { createdAt: "desc" },
      });
      if (existing) return { order: existing, created: false };
      const order = await tx.order.create({ data: {
        user: { connect: { id: userId } }, address: { create: { ...address, country: "AU" } },
        subtotal: 0, shippingCost: 0, tax: 0, total: Math.round(plan.price * 100) / 100,
        membershipAmount: Math.round(plan.price * 100) / 100, membershipPlanId: plan.id, membershipDurationDays: plan.durationDays,
      } });
      return { order, created: true };
    });
    if (!result) return NextResponse.json({ error: "You already have an active membership." }, { status: 409 });
    const { order } = result;
    const returnUrl = `${appUrl.replace(/\/$/, "")}/order-confirmation/${order.id}?return_token=${createOrderReturnToken(order.id)}`;
    if (!result.created) return NextResponse.json({ url: returnUrl });
    createdOrderId = order.id;
    const [firstName, ...lastName] = address.name.split(/\s+/);
    stage = "create-hosted-checkout";
    const checkout = await createOnlinePayCheckout({
      amountCents: Math.round(order.total * 100), merchantReference: order.id,
      returnUrl, shopUrl: returnUrl,
      customer: { email: session.user.email, firstName, lastName: lastName.join(" ") || firstName,
        address1: address.line1, city: address.suburb, state: address.state, postcode: address.postcode },
      lineItems: [{ name: `${plan.name} membership`, quantity: 1, unitPriceCents: Math.round(order.total * 100) }],
    });
    stage = "save-hosted-checkout";
    await db.order.update({ where: { id: order.id }, data: { paywayTransactionId: `ONLINEPAY:${checkout.id}` } });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code) && !createdOrderId) {
      console.error("[membership checkout] Database schema is out of date. Run npm run db:deploy.", { code: error.code });
      return NextResponse.json({ error: "Membership checkout is temporarily unavailable. Please try again later." }, { status: 503 });
    }
    if (createdOrderId && error instanceof OnlinePayCheckoutError && error.definitelyRejected) {
      try {
        await db.order.updateMany({ where: { id: createdOrderId, status: "PENDING", paywayTransactionId: null }, data: { status: "CANCELLED" } });
      } catch {
        console.error("[membership checkout] Could not cancel rejected checkout", { orderId: createdOrderId });
      }
    }
    // Do not create another charge when the provider's outcome is unknown.
    console.error("[membership checkout] Unable to create or record hosted checkout", {
      stage, orderId: createdOrderId,
      ...(error instanceof OnlinePayCheckoutError ? { httpStatus: error.httpStatus, invalidFields: error.invalidFields, definitelyRejected: error.definitelyRejected } : {}),
      ...(error instanceof Prisma.PrismaClientKnownRequestError ? { databaseCode: error.code } : {}),
    });
    if (error instanceof OnlinePayCheckoutError && error.definitelyRejected && error.invalidFields.some(field => field.startsWith("customer_details.billing."))) {
      return NextResponse.json({ error: "The payment provider rejected your billing details. Please check your name and address and try again." }, { status: 400 });
    }
    return NextResponse.json({ error: "Checkout could not be confirmed. Check your orders or contact support before trying again." }, { status: 502 });
  }
}
