/**
 * GET /api/orders/[id]/poll-payment
 *
 * REL-4 fix: Resolves orders that PayWay returned as "pending" at checkout time.
 *
 * PayWay does not push webhook notifications in all configurations — it requires
 * the merchant to poll GET /transactions/:id. This endpoint is called by the
 * order confirmation page (and can be called by a background job) to check
 * whether a pending PayWay transaction has settled.
 *
 * Behaviour:
 *   - approved / approved*  → runs the same atomic post-payment transaction as
 *                             the main checkout route: stock decrement (with
 *                             oversell guard), coupon claim, order → PAID.
 *                             Sends confirmation notifications.
 *   - declined / suspended  → cancels the order.
 *   - still pending         → returns 202 so the client can retry.
 *   - voided                → cancels the order.
 *
 * Idempotent: if the order is already PAID or CANCELLED it returns immediately.
 *
 * Auth: the caller must be the order owner, a guest whose email matches, or an
 * ADMIN. This prevents enumeration of arbitrary order payment states.
 */

import { after, NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { verifyGuestOrderToken, verifyOrderReturnToken } from "@/lib/order-access";
import { getTransaction, PayWayApiError } from "@/lib/payway";
import { getOnlinePayCheckout, onlinePayPaymentFailed, onlinePayPaymentSucceeded } from "@/lib/onlinepay";
import { activateMembershipInTransaction } from "@/lib/membership";
import { queueOrderConfirmation, queueRefundAction, processDueEmailJobs } from "@/lib/email-outbox";
import { sendOrderConfirmationSms, sendOrderWhatsApp } from "@/lib/twilio";
import { timingSafeEqual } from "crypto";
import { releaseCouponReservationInTransaction } from "@/lib/coupon-reservation";

type Params = { params: Promise<{ id: string }> };

function isInternalOnlinePayWebhook(req: NextRequest): boolean {
  const expected = process.env.ONLINEPAY_WEBHOOK_SECRET;
  const supplied = req.headers.get("x-onlinepay-webhook-secret");
  if (!expected || expected.length < 32 || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: orderId } = await params;

    // Basic CUID format guard
    if (!/^c[a-z0-9]{24,}$/.test(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const session = isInternalOnlinePayWebhook(req) ? null : await auth();

    // Fetch the order with everything needed for post-payment processing
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
        address: true,
        user: { select: { email: true, name: true, phone: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // ── Authorization ──────────────────────────────────────────────────────────
    const isAdmin = session?.user?.role === "ADMIN";
    const isOwner = session?.user?.id && order.userId === session.user.id;
    const isReturn = verifyOrderReturnToken(order.id, req.nextUrl.searchParams.get("return_token"));
    const isGuest = !order.userId && verifyGuestOrderToken(order.id, order.guestEmail, req.nextUrl.searchParams.get("token"));
    // The webhook handler uses a server-only secret to bypass customer
    // authorization. It is never trusted as payment proof: the Checkout API
    // is read server-to-server and must report the matching paid transaction.
    const isOnlinePayWebhook = isInternalOnlinePayWebhook(req);
    if (!isAdmin && !isOwner && !isGuest && !isReturn && !isOnlinePayWebhook) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Idempotency — nothing to do if already settled ─────────────────────────
    if (order.status === "PAID" || order.status === "CONFIRMED" ||
        order.status === "PROCESSING" || order.status === "SHIPPED" ||
        order.status === "OUT_FOR_DELIVERY" || order.status === "DELIVERED") {
      return NextResponse.json({ status: "paid", orderId: order.id });
    }
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return NextResponse.json({ status: "cancelled", orderId: order.id });
    }

    // Only process orders that are PENDING with a PayWay transaction ID
    if (order.status !== "PENDING" || !order.paywayTransactionId) {
      return NextResponse.json(
        { status: "pending", orderId },
        { status: 202 }
      );
    }

    // ── Poll the payment provider for the current transaction status ───────────
    let txn;
    let checkoutUrl: string | undefined;
    try {
      if (order.paywayTransactionId.startsWith("ONLINEPAY:")) {
        const checkoutId = order.paywayTransactionId.slice("ONLINEPAY:".length);
        const checkout = await getOnlinePayCheckout(checkoutId);
        // A checkout ID is only valid for this order when the provider echoes
        // the merchant reference that we originally supplied.
        if (checkout.id !== checkoutId || checkout.merchant_reference !== order.id ||
            checkout.amount !== Math.round(order.total * 100) || checkout.currency_code !== "AUD") {
          console.error(`[poll-payment] OnlinePay reference mismatch for order ${orderId}`);
          return NextResponse.json({ error: "Payment verification failed" }, { status: 502 });
        }
        checkoutUrl = typeof checkout.url === "string" ? checkout.url : undefined;
        txn = {
          transactionId: checkout.transaction_id ?? checkoutId,
          status: onlinePayPaymentSucceeded(checkout)
            ? "approved"
            : onlinePayPaymentFailed(checkout) ? "declined" : "pending",
          responseText: "",
          responseCode: "",
        };
      } else {
        txn = await getTransaction(order.paywayTransactionId);
      }
    } catch (err) {
      console.error(`[poll-payment] Provider transaction lookup failed for order ${orderId}`, err);
      const msg =
        err instanceof PayWayApiError
          ? (err.errors[0]?.message ?? err.message)
          : "Could not reach payment provider. Please try again shortly.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    // ── Handle each PayWay status ──────────────────────────────────────────────

    if (txn.status === "pending") {
      // Payment not yet settled — tell client to retry
      return NextResponse.json({ status: "pending", orderId: order.id, checkoutUrl }, { status: 202 });
    }

    if (txn.status === "declined" || txn.status === "suspended" || txn.status === "voided") {
      await db.$transaction(async (tx) => {
        await tx.order.updateMany({
          where: { id: orderId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
        await releaseCouponReservationInTransaction(tx, orderId);
      });
      return NextResponse.json(
        {
          status: "cancelled",
          orderId: order.id,
          error: txn.responseText || "Payment was not approved.",
        },
        { status: 402 }
      );
    }

    if (txn.status === "approved" || txn.status === "approved*") {
      // ── Atomic post-payment transaction: stock guard + order PAID ─────────────
      try {
        const settled = await db.$transaction(async (tx) => {
          // The conditional update locks and claims this order atomically.
          const claimed = await tx.order.updateMany({
            where: { id: orderId, status: "PENDING" }, data: { status: "PAID" },
          });
          if (!claimed.count) return false;

          // Atomic stock decrement with oversell guard (same pattern as checkout)
          for (const item of order.items) {
            if (item.productVariantId) {
              const updated = await tx.productVariant.updateMany({
                where: {
                  id: item.productVariantId,
                  stock: { gte: item.quantity },
                },
                data: { stock: { decrement: item.quantity } },
              });
              if (updated.count === 0) {
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
                  stock: { gte: item.quantity },
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

          await tx.order.update({
            where: { id: orderId },
            data: {
              status: "PAID",
              paywayTransactionId: order.paywayTransactionId,
              couponReserved: false,
            },
          });
          await queueOrderConfirmation(tx, orderId);
          if (order.membershipAmount > 0 && order.userId) {
            await activateMembershipInTransaction(tx, { userId: order.userId, planId: order.membershipPlanId, durationDays: order.membershipDurationDays ?? undefined, amountPaid: order.membershipAmount, paywaySessionId: `order:${order.id}:membership` });
          }
          return true;
        });
        if (!settled) return NextResponse.json({ status: "pending", orderId }, { status: 202 });
        if (order.membershipAmount > 0) {
          try { revalidatePath("/admin/membership"); } catch {}
        }
      } catch (txErr) {
        const message = txErr instanceof Error ? txErr.message : "";
        if (message.startsWith("OUT_OF_STOCK:")) {
          const productName = message.replace("OUT_OF_STOCK:", "");
          await db.$transaction(async tx => {
            const changed = await tx.order.updateMany({
              where: { id: orderId, status: "PENDING" },
              data: { status: "CANCELLED", refundRequested: true, refundReason: "Payment approved but stock unavailable; refund required" },
            });
            if (changed.count) await queueRefundAction(tx, orderId);
          });
          console.error(
            `[poll-payment] Stock exhausted post-payment for "${productName}". ` +
              `Order ${orderId} cancelled. PayWay txn ${txn.transactionId} needs manual refund.`
          );
          return NextResponse.json(
            {
              error: `Sorry, "${productName}" just sold out. Please contact support for a refund.`,
              status: "out_of_stock",
            },
            { status: 409 }
          );
        }
        console.error("[poll-payment] Post-payment transaction failed", txErr);
        return NextResponse.json(
          { error: "Order could not be completed. Please contact support." },
          { status: 500 }
        );
      }

      // ── Send confirmation notifications ────────────────────────────────────────
      const phone = order.user?.phone ?? order.guestPhone;

    after(async () => {
      if (phone) {
        await sendOrderConfirmationSms(phone, order.id, order.total).catch(() => {});
        await sendOrderWhatsApp(phone, order.id, order.total).catch(() => {});
      }
      await processDueEmailJobs().catch((err) => {
        console.error("[poll-payment] Immediate email job processing failed", err);
      });
    });

      return NextResponse.json({ status: "paid", orderId: order.id });
    }

    // Unexpected status from PayWay
    console.warn(`[poll-payment] Unexpected PayWay status "${txn.status}" for order ${orderId}`);
    return NextResponse.json({ status: "pending", orderId: order.id, checkoutUrl }, { status: 202 });
  } catch (error) {
    console.error("[GET /api/orders/[id]/poll-payment]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
