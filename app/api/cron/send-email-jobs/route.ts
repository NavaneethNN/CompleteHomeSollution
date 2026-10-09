import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, sendOrderConfirmationEmail, sendOrderCancellationEmail, sendShippingUpdateEmail, sendRefundRequestEmail } from "@/lib/brevo";
import { z } from "zod";
import { sendOrderStatusNotification } from "@/lib/order-status-notifications";
import { sendShippingUpdateSms } from "@/lib/twilio";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { emailRetryMinutes } from "@/lib/email-outbox";
import { siteOrigin } from "@/lib/site-indexing";

export const runtime = "nodejs";
export const maxDuration = 60;

const refundPayload = z.object({
  refundAmount: z.number().positive().finite(),
  autoRefunded: z.boolean(),
  isPartial: z.boolean(),
  audience: z.enum(["customer", "admin"]),
});

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const deadline = Date.now() + 40_000;
  const due = await db.emailJob.findMany({
    where: { OR: [
      { status: "PENDING", nextAttemptAt: { lte: now } },
      { status: "CLAIMED", claimUntil: { lte: now } },
    ] },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: 20,
  });
  let sent = 0;
  let failed = 0;
  for (const job of due) {
    if (Date.now() >= deadline) break;
    const claimUntil = new Date(Date.now() + 5 * 60_000);
    const claimed = await db.emailJob.updateMany({
      where: { id: job.id, OR: [
        { status: "PENDING", nextAttemptAt: { lte: now } },
        { status: "CLAIMED", claimUntil: { lte: now } },
      ] },
      data: { status: "CLAIMED", claimUntil, attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      if (!["ORDER_CUSTOMER", "ORDER_ADMIN", "REFUND_ACTION", "PAYMENT_REVIEW", "FULFILLMENT_REVIEW", "REFUND_RECEIPT", "REFUND_REQUEST", "SHIPPING", "SHIPPING_SMS", "ORDER_STATUS"].includes(job.kind)) throw new Error("Unknown email job");
      const order = await db.order.findUnique({
        where: { id: job.orderId },
        include: { user: { select: { name: true, email: true, phone: true } }, address: true, items: { include: { product: { select: { name: true } } } } },
      });
      if (!order || (["ORDER_CUSTOMER", "ORDER_ADMIN"].includes(job.kind) && order.status === "PENDING")) throw new Error("Order unavailable");
      const actionNeeded = job.kind === "REFUND_ACTION" ? order.refundRequested && order.status !== "REFUNDED"
        : job.kind === "PAYMENT_REVIEW" ? order.status === "PENDING"
        : job.kind === "FULFILLMENT_REVIEW" ? ["PAID", "CONFIRMED", "PROCESSING"].includes(order.status)
        : false;
      if (job.kind === "ORDER_STATUS") {
        const payload = z.object({ status: z.enum(["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]), previousStatus: z.string() }).parse(job.payload);
        // Don't send an obsolete status after a newer transition has occurred.
        if (order.status === payload.status) {
          const email = order.user?.email ?? order.guestEmail;
          if (!email) throw new Error("Customer email unavailable");
          await sendOrderStatusNotification({
            orderId: order.id, orderNumber: order.id, customerName: order.user?.name ?? order.address.name ?? "Customer",
            customerEmail: email, newStatus: payload.status, previousStatus: payload.previousStatus,
            trackingNumber: order.trackingNumber ?? undefined, carrier: order.carrier ?? undefined,
            items: order.items.map(item => ({ productName: item.product.name, quantity: item.quantity, price: item.unitPrice })),
            total: order.total, shippingAddress: { ...order.address, line2: order.address.line2 ?? undefined }, idempotencyKey: job.id,
          });
        }
      } else if (job.kind === "REFUND_REQUEST") {
        const payload = z.object({ reason: z.string().max(1000), audience: z.enum(["customer", "admin"]) }).parse(job.payload);
        const email = order.user?.email ?? order.guestEmail;
        if (!email && payload.audience === "customer") throw new Error("Customer email unavailable");
        await sendRefundRequestEmail({
          ...payload, email: email ?? "info@completehomesollution.com.au",
          name: order.user?.name ?? order.address.name ?? "Customer", orderId: order.id,
          total: order.total, idempotencyKey: job.id,
        });
      } else if (job.kind === "REFUND_RECEIPT") {
        const payload = refundPayload.parse(job.payload);
        const email = order.user?.email ?? order.guestEmail;
        if (!email && payload.audience === "customer") throw new Error("Customer email unavailable");
        await sendOrderCancellationEmail({
          ...payload, email: email ?? "info@completehomesollution.com.au",
          name: order.user?.name ?? order.address.name ?? "Customer", orderId: order.id,
          total: order.total, idempotencyKey: job.id,
        });
      } else if (job.kind === "SHIPPING_SMS") {
        const phone = order.user?.phone ?? order.guestPhone;
        if (phone && ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
          if (!order.trackingNumber || !order.carrier) throw new Error("Shipping details unavailable");
          await sendShippingUpdateSms(phone, order.id, order.trackingNumber, order.carrier);
        }
      } else if (job.kind === "SHIPPING") {
        if (["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
          const email = order.user?.email ?? order.guestEmail;
          if (!email || !order.trackingNumber || !order.carrier) throw new Error("Shipping details unavailable");
          await sendShippingUpdateEmail({
            email, name: order.user?.name ?? order.address.name ?? "Customer", orderId: order.id,
            trackingNumber: order.trackingNumber, carrier: order.carrier, idempotencyKey: job.id,
          });
        }
      } else if (["REFUND_ACTION", "PAYMENT_REVIEW", "FULFILLMENT_REVIEW"].includes(job.kind)) {
        if (actionNeeded) {
          const subject = job.kind === "REFUND_ACTION" ? "Refund action required" : job.kind === "PAYMENT_REVIEW" ? "Payment review required" : "Fulfillment review required";
          await sendEmail({
            to: [{ email: "info@completehomesollution.com.au" }],
            subject: `${subject} for order ${order.id}`,
            htmlContent: `<p>${subject}.</p><p>Order: ${order.id}</p><p><a href="${siteOrigin()}/admin/orders/${order.id}">Review order</a></p>`,
            headers: { idempotencyKey: job.id },
          });
        }
      } else if (order.status === "CANCELLED" || order.status === "REFUNDED") {
        // A cancelled order must not receive an order-confirmed receipt.
      } else {
      const email = order.user?.email ?? order.guestEmail;
      if (job.kind === "ORDER_CUSTOMER" && email) {
        await sendOrderConfirmationEmail({
          email, name: order.user?.name ?? order.address.name ?? "Customer", orderId: order.id, total: order.total,
          items: order.items.map(item => ({ name: item.product.name, quantity: item.quantity, price: item.unitPrice })),
          address: order.address, customerEmail: email, audience: "customer", idempotencyKey: job.id,
        });
      } else if (job.kind === "ORDER_ADMIN") {
        await sendOrderConfirmationEmail({
          email: email ?? "info@completehomesollution.com.au", name: order.user?.name ?? order.address.name ?? "Customer", orderId: order.id, total: order.total,
          items: order.items.map(item => ({ name: item.product.name, quantity: item.quantity, price: item.unitPrice })),
          address: order.address, customerEmail: email ?? undefined, audience: "admin", idempotencyKey: job.id,
        });
      }
      }
      await db.emailJob.updateMany({ where: { id: job.id, status: "CLAIMED", claimUntil, attempts: job.attempts + 1 }, data: { status: "SENT", sentAt: new Date(), claimUntil: null, lastError: null } });
      sent++;
    } catch {
      await db.emailJob.updateMany({ where: { id: job.id, status: "CLAIMED", claimUntil, attempts: job.attempts + 1 }, data: {
        status: "PENDING", claimUntil: null,
        nextAttemptAt: new Date(Date.now() + emailRetryMinutes(job.attempts + 1) * 60_000),
        lastError: "Delivery failed",
      } });
      failed++;
    }
  }
  return NextResponse.json({ checked: due.length, sent, failed });
}
