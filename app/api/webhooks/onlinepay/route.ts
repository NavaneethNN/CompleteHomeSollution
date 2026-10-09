import { NextRequest, NextResponse } from "next/server";
import { GET as pollPayment } from "@/app/api/orders/[id]/poll-payment/route";
import { db } from "@/lib/db";
import { getOnlinePayCheckout } from "@/lib/onlinepay";
import { timingSafeEqual } from "node:crypto";

function hasConfiguredSecret(): string | null {
  const secret = process.env.ONLINEPAY_WEBHOOK_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function hasValidWebhookSecret(req: NextRequest, expected: string): boolean {
  const supplied =
    req.headers.get("x-onlinepay-webhook-secret") ??
    req.nextUrl.searchParams.get("secret");
  if (!supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

/**
 * OnlinePay notifications are a delivery signal, not payment proof. The order
 * polling endpoint performs a server-to-server Checkout API lookup before it
 * can mark an order PAID.
 *
 * Configure this URL in OnlinePay as a "Full event payload" notification for
 * both Checkout - Transaction succeeded and Checkout - Transaction failed.
 */
export async function POST(req: NextRequest) {
  // OnlinePay's notification confirms delivery, but payment status is always
  // verified by our server with the Checkout API below. A local secret prevents
  // outside callers from impersonating this internal settlement request.
  const secret = hasConfiguredSecret();
  if (!secret) {
    console.error("[onlinepay webhook] ONLINEPAY_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  if (!hasValidWebhookSecret(req, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await req.json().catch(() => null) as Record<string, unknown> | null;
  const content = payload?.content as Record<string, unknown> | undefined;
  let reference = typeof content?.merchant_reference === "string" ? content.merchant_reference : null;
  const checkoutId = payload?.eventId ?? payload?.recordId;
  if (!reference && typeof checkoutId === "string" && /^[a-zA-Z0-9-]{8,128}$/.test(checkoutId)) {
    const order = await db.order.findFirst({ where: { paywayTransactionId: `ONLINEPAY:${checkoutId}` }, select: { id: true } });
    reference = order?.id ?? null;
    if (!reference) return NextResponse.json({ error: "Checkout not recorded yet; retry notification" }, { status: 503 });
  }
  const eventType = typeof payload?.eventType === "string" ? payload.eventType : "";
  if (!reference || !/^c[a-z0-9]{24,}$/.test(reference) || !/^Checkout - Transaction (succeeded|failed)$/.test(eventType)) {
    return NextResponse.json({ received: true });
  }

  // Recover a checkout whose creation succeeded but whose ID could not be
  // committed locally. Verify the provider lookup before attaching it.
  const localOrder = await db.order.findUnique({ where: { id: reference }, select: { id: true, status: true, total: true, paywayTransactionId: true } });
  if (!localOrder) return NextResponse.json({ error: "Order not recorded yet" }, { status: 503 });
  if (localOrder.status === "PENDING" && !localOrder.paywayTransactionId) {
    if (typeof checkoutId !== "string" || !/^[a-zA-Z0-9-]{8,128}$/.test(checkoutId)) return NextResponse.json({ error: "Checkout ID unavailable; retry notification" }, { status: 503 });
    try {
      const verified = await getOnlinePayCheckout(checkoutId);
      if (verified.id !== checkoutId || verified.merchant_reference !== localOrder.id || verified.amount !== Math.round(localOrder.total * 100) || verified.currency_code !== "AUD") {
        return NextResponse.json({ error: "Checkout verification failed" }, { status: 422 });
      }
      await db.order.updateMany({ where: { id: localOrder.id, status: "PENDING", paywayTransactionId: null }, data: { paywayTransactionId: `ONLINEPAY:${checkoutId}` } });
    } catch {
      return NextResponse.json({ error: "Checkout lookup unavailable" }, { status: 503 });
    }
  }

  const internalRequest = new NextRequest(`http://localhost/api/orders/${reference}/poll-payment`, {
    headers: { "x-onlinepay-webhook-secret": secret },
  });
  const response = await pollPayment(internalRequest, { params: Promise.resolve({ id: reference }) });
  if (!response.ok && response.status !== 202 && response.status !== 402 && response.status !== 409) {
    console.error("[onlinepay webhook] order settlement failed", await response.text());
    return NextResponse.json({ error: "Could not process notification" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
