import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { db } from "@/lib/db";
import { queueOrderConfirmation, queueRefundAction } from "@/lib/email-outbox";
import { sendOrderConfirmationSms, sendOrderWhatsApp } from "@/lib/twilio";
import { activateMembership } from "@/lib/membership";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    event = await constructWebhookEvent(body, signature);
  } catch (err) {
    console.error("[Stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status !== "paid") return NextResponse.json({ received: true });

      // ── Standalone membership purchase (from /account/membership page) ──
      if (session.metadata?.type === "membership") {
        const userId = session.metadata?.userId;
        if (!userId) {
          console.error("[Stripe webhook] Membership session missing userId");
          return NextResponse.json({ received: true });
        }
        const planId = session.metadata?.planId ?? null;
        const amountPaid = (session.amount_total ?? 0) / 100;
        const result = await activateMembership({
          userId,
          planId,
          paywaySessionId: session.id,
          amountPaid,
        });
        if (result.alreadyProcessed) {
          console.log(`[Stripe webhook] Membership already processed for session ${session.id} — skipping`);
        } else {
          console.log(`[Stripe webhook] Membership activated/renewed for user ${userId}, expires ${result.expiresAt?.toISOString()}`);
        }
        return NextResponse.json({ received: true });
      }

      // ── Normal order checkout (may also include membership add-on) ──
      const orderId = session.metadata?.orderId;

      if (!orderId) return NextResponse.json({ received: true });

      // Atomically update order + decrement stock in a transaction
      // Idempotency check is INSIDE the transaction to prevent race conditions
      // where concurrent Stripe retries could both pass a pre-transaction status check
      let order;
      try {
      order = await db.$transaction(async (tx) => {
        // Re-check status inside transaction — atomic idempotency guard
        const freshOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, status: true, stripePaymentId: true },
        });
        if (!freshOrder) {
          throw new Error(`Order not found: ${orderId}`);
        }
        // Idempotency: if stripePaymentId is already recorded, payment was already fully processed
        if (freshOrder.stripePaymentId) {
          return null; // already processed — skip stock decrement and status update
        }

        const claimed = await tx.order.updateMany({ where: { id: orderId, status: "PENDING", paywayTransactionId: null }, data: { status: "PAID" } });
        if (!claimed.count) return null;

        // Re-check stock for each item before decrementing
        const items = await tx.orderItem.findMany({
          where: { orderId },
          include: { product: { select: { name: true } } },
        });

        for (const item of items) {
          if (item.productVariantId) {
            const variant = await tx.productVariant.findUnique({
              where: { id: item.productVariantId },
              select: { stock: true },
            });
            if (!variant || variant.stock < item.quantity) {
              throw new Error(`Insufficient stock for variant ${item.productVariantId}`);
            }
            const changed = await tx.productVariant.updateMany({
              where: { id: item.productVariantId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
            if (!changed.count) throw new Error("Insufficient stock");
          } else {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: { stock: true },
            });
            if (!product || product.stock < item.quantity) {
              throw new Error(`Insufficient stock for product ${item.productId}`);
            }
            const changed = await tx.product.updateMany({
              where: { id: item.productId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
            if (!changed.count) throw new Error("Insufficient stock");
          }
        }

        const paidOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: "PAID",
            stripePaymentId: session.payment_intent as string ?? undefined,
          },
          include: {
            items: { include: { product: { select: { name: true } } } },
            address: true,
            user: true,
          },
        });
        await queueOrderConfirmation(tx, orderId);
        return paidOrder;
      });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith("Insufficient stock")) throw error;
        await db.$transaction(async tx => {
          const changed = await tx.order.updateMany({
            where: { id: orderId, status: "PENDING" },
            data: { status: "CANCELLED", stripePaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
              refundRequested: true, refundReason: "Stripe payment approved but stock unavailable; refund required" },
          });
          if (changed.count) await queueRefundAction(tx, orderId);
        });
        return NextResponse.json({ received: true, refundRequired: true });
      }

      // Skip post-processing if already handled (idempotency)
      if (!order) return NextResponse.json({ received: true });

      // ── Membership add-on: activate if included in this order payment ──
      const addMembership = session.metadata?.addMembership === "1";
      const userId = session.metadata?.userId;
      if (addMembership && userId) {
        const orderPlan = await db.membershipPlan.findFirst({
          where: { isActive: true, isDefault: true },
          select: { price: true },
        });
        await activateMembership({
          userId,
          paywaySessionId: `${session.id}-membership`,
          amountPaid: orderPlan?.price ?? 30,
        });
        console.log(`[Stripe webhook] Membership add-on activated for user ${userId}`);
      }

      const phone = order.user?.phone ?? order.guestPhone;

      if (phone) {
        await sendOrderConfirmationSms(phone, order.id, order.total).catch(
          (e) => console.error("SMS send failed", e)
        );
        await sendOrderWhatsApp(phone, order.id, order.total).catch(
          (e) => console.error("WhatsApp send failed", e)
        );
      }
    }

    // ── Session expired (user abandoned checkout) ──────────────────────────
    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      if (session.payment_status === "paid") return NextResponse.json({ received: true });
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await db.order.updateMany({
          where: { id: orderId, status: "PENDING", paywayTransactionId: null, stripePaymentId: null },
          data: { status: "CANCELLED" },
        }).catch((e) => console.error("[Stripe webhook] Order cancellation failed", e));
        console.log(`[Stripe webhook] Order ${orderId} cancelled (session expired)`);
      }
    }

    // ── Async payment failed (e.g. bank transfer / BNPL declined) ────────────
    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      if (session.payment_status === "paid") return NextResponse.json({ received: true });
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await db.order.updateMany({
          where: { id: orderId, status: "PENDING", paywayTransactionId: null, stripePaymentId: null },
          data: { status: "CANCELLED" },
        }).catch((e) => console.error("[Stripe webhook] Async payment fail update failed", e));
        console.log(`[Stripe webhook] Order ${orderId} cancelled (async payment failed)`);
      }
    }

    // ── Payment intent failed (card declined, insufficient funds, etc.) ─────
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      // Find order by stripePaymentId or metadata
      const orderId = (paymentIntent.metadata as Record<string, string>)?.orderId;
      if (orderId) {
        // Only cancel if still PENDING (don't touch already-paid orders)
        const existingOrder = await db.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });
        if (existingOrder?.status === "PENDING") {
          await db.order.updateMany({
            where: { id: orderId, status: "PENDING", paywayTransactionId: null, stripePaymentId: null },
            data: { status: "CANCELLED" },
          }).catch((e) => console.error("[Stripe webhook] Payment failed update error", e));
          console.log(`[Stripe webhook] Order ${orderId} cancelled (payment failed: ${paymentIntent.last_payment_error?.message ?? "unknown"})`);
        }
      }
    }

    // ── Refund issued ─────────────────────────────────────────────────
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (paymentIntentId) {
        // Find order by stripePaymentId
        const refundedOrder = await db.order.findFirst({
          where: { stripePaymentId: paymentIntentId },
          select: { id: true, status: true },
        });
        if (refundedOrder && refundedOrder.status !== "REFUNDED") {
          await db.order.update({
            where: { id: refundedOrder.id },
            data: { status: "REFUNDED" },
          }).catch((e) => console.error("[Stripe webhook] Refund update failed", e));
          console.log(`[Stripe webhook] Order ${refundedOrder.id} marked REFUNDED`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe webhook] processing error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
