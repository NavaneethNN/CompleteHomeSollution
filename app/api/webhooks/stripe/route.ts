import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/brevo";
import { sendOrderConfirmationSms, sendOrderWhatsApp } from "@/lib/twilio";

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

      // ── Standalone membership purchase (from /account/membership page) ──
      if (session.metadata?.type === "membership") {
        const userId = session.metadata?.userId;
        if (!userId) {
          console.error("[Stripe webhook] Membership session missing userId");
          return NextResponse.json({ received: true });
        }
        const planId = session.metadata?.planId;
        const plan = planId
          ? await db.membershipPlan.findUnique({ where: { id: planId }, select: { durationDays: true } })
          : await db.membershipPlan.findFirst({ where: { isActive: true, isDefault: true }, select: { durationDays: true } });
        const durationDays = plan?.durationDays ?? 365;
        const existing = await db.user.findUnique({
          where: { id: userId },
          select: { isMember: true, membershipExpiry: true },
        });
        const now = new Date();
        const baseDate = existing?.membershipExpiry && existing.membershipExpiry > now
          ? existing.membershipExpiry
          : now;
        const expiry = new Date(baseDate);
        expiry.setDate(expiry.getDate() + durationDays);
        await db.user.update({
          where: { id: userId },
          data: {
            isMember: true,
            memberSince: existing?.isMember ? undefined : now,
            membershipExpiry: expiry,
          },
        });
        // Record payment for spend tracking (idempotent via stripeSessionId unique)
        const amountPaid = (session.amount_total ?? 0) / 100;
        if (amountPaid > 0) {
          await db.membershipPayment.upsert({
            where: { stripeSessionId: session.id },
            create: { userId, planId: planId ?? null, amount: amountPaid, stripeSessionId: session.id },
            update: {},
          });
        }
        console.log(`[Stripe webhook] Membership activated/renewed for user ${userId}, expires ${expiry.toISOString()}`);
        return NextResponse.json({ received: true });
      }

      // ── Normal order checkout (may also include membership add-on) ──
      const orderId = session.metadata?.orderId;

      if (!orderId) return NextResponse.json({ received: true });

      // Atomically update order + decrement stock in a transaction
      // Idempotency check is INSIDE the transaction to prevent race conditions
      // where concurrent Stripe retries could both pass a pre-transaction status check
      const order = await db.$transaction(async (tx) => {
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
            await tx.productVariant.update({
              where: { id: item.productVariantId },
              data: { stock: { decrement: item.quantity } },
            });
          } else {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: { stock: true },
            });
            if (!product || product.stock < item.quantity) {
              throw new Error(`Insufficient stock for product ${item.productId}`);
            }
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }

        return tx.order.update({
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
      });

      // Skip post-processing if already handled (idempotency)
      if (!order) return NextResponse.json({ received: true });

      // ── Membership add-on: activate if included in this order payment ──
      const addMembership = session.metadata?.addMembership === "1";
      const userId = session.metadata?.userId;
      if (addMembership && userId) {
        const currentUser = await db.user.findUnique({
          where: { id: userId },
          select: { isMember: true },
        });
        const orderPlan = await db.membershipPlan.findFirst({ where: { isActive: true, isDefault: true }, select: { durationDays: true } });
        const orderDuration = orderPlan?.durationDays ?? 365;
        const orderNow = new Date();
        const orderExpiry = new Date(orderNow);
        orderExpiry.setDate(orderExpiry.getDate() + orderDuration);
        if (!currentUser?.isMember) {
          await db.user.update({
            where: { id: userId },
            data: { isMember: true, memberSince: orderNow, membershipExpiry: orderExpiry },
          });
          console.log(`[Stripe webhook] Membership activated (via order) for user ${userId}`);
        }
        // Record membership add-on payment separately for spend tracking
        const membershipPlanPrice = orderPlan
          ? await db.membershipPlan.findFirst({ where: { isActive: true, isDefault: true }, select: { price: true } })
          : null;
        if (membershipPlanPrice?.price) {
          await db.membershipPayment.upsert({
            where: { stripeSessionId: `${session.id}-membership` },
            create: { userId, planId: null, amount: membershipPlanPrice.price, stripeSessionId: `${session.id}-membership` },
            update: {},
          });
        }
      }

      const email = order.user?.email ?? order.guestEmail;
      const name = order.user?.name ?? "Customer";
      const phone = order.user?.phone ?? order.guestPhone;

      if (email) {
        await sendOrderConfirmationEmail({
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
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await db.order.update({
          where: { id: orderId },
          data: { status: "CANCELLED" },
        }).catch((e) => console.error("[Stripe webhook] Order cancellation failed", e));
        console.log(`[Stripe webhook] Order ${orderId} cancelled (session expired)`);
      }
    }

    // ── Async payment failed (e.g. bank transfer / BNPL declined) ────────────
    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await db.order.update({
          where: { id: orderId },
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
          await db.order.update({
            where: { id: orderId },
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
