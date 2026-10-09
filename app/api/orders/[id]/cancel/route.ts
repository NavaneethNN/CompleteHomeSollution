import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { refundTransaction } from "@/lib/payway";
import { refundOnlinePayOrder, OnlinePayRefundError } from "@/lib/onlinepay";
import { refundOrderMembership } from "@/lib/membership";
import { queueRefundReceipt, queueRefundRequest } from "@/lib/email-outbox";

// Statuses where we auto-refund immediately (order not yet shipped)
const AUTO_REFUND_STATUSES = ["PAID", "CONFIRMED", "PROCESSING"];
// Statuses where we can only request a refund (admin decides)
const REFUND_REQUEST_STATUSES = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
// Statuses that cannot be cancelled at all
const NON_CANCELLABLE_STATUSES = ["CANCELLED", "REFUNDED"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 1000) : "";

    // Fetch order with ownership check
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { name: true } } } },
        address: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (NON_CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json({ error: `Order cannot be cancelled (status: ${order.status})` }, { status: 400 });
    }

    const requestReview = () => db.$transaction(async tx => {
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: order.status, refundRequested: false, refundProcessing: false },
        data: { refundRequested: true, refundReason: reason || "Customer requested refund" },
      });
      if (changed.count) await queueRefundRequest(tx, orderId, reason || "Customer requested refund");
      return changed.count;
    });

    if (AUTO_REFUND_STATUSES.includes(order.status) && (!order.paywayTransactionId || order.membershipAmount > 0)) {
      await requestReview();
      return NextResponse.json({ success: true, autoRefunded: false });
    }
    if (AUTO_REFUND_STATUSES.includes(order.status)) {
      if (order.refundAmount) return NextResponse.json({ error: "This order has a partial refund. Contact support." }, { status: 409 });
      const resuming = order.paywayTransactionId?.startsWith("ONLINEPAY:") && order.refundProcessing && order.refundAttemptAmount === order.total && order.refundAttemptRestoreStock === true;
      const claimed = resuming ? { count: 1 } : await db.order.updateMany({ where: { id: orderId, status: order.status, refundProcessing: false, refundAmount: order.refundAmount }, data: { refundProcessing: true, refundAttemptAmount: order.total, refundAttemptRestoreStock: true } });
      if (!claimed.count) return NextResponse.json({ error: "Refund is already processing. Contact support before retrying." }, { status: 409 });
      let paywayRefundId: string | null = null;

      if (order.paywayTransactionId) {
        try {
          const refundTxn = order.paywayTransactionId.startsWith("ONLINEPAY:")
            ? await refundOnlinePayOrder({ checkoutId: order.paywayTransactionId.slice(10), orderId, orderTotal: order.total, amount: order.total, refundedBefore: 0 })
            : await refundTransaction({
            parentTransactionId: order.paywayTransactionId!,
            principalAmount: order.total,
            orderNumber: order.id,
          });
          if (refundTxn.status !== "approved" && refundTxn.status !== "approved*") {
            if (refundTxn.status === "declined" || refundTxn.status === "voided") await db.order.update({ where: { id: orderId }, data: { refundProcessing: false } });
            return NextResponse.json({ error: "Refund has not been confirmed. Contact support." }, { status: 409 });
          }
          paywayRefundId = String(refundTxn.transactionId);
        } catch (e) {
          if (e instanceof OnlinePayRefundError && e.safeToRetry) await db.order.update({ where: { id: orderId }, data: { refundProcessing: false } });
          console.error("[cancel] Payment provider refund failed", e);
          return NextResponse.json({ error: "Refund failed — please contact support" }, { status: 502 });
        }
      }

      // Restore stock atomically
      const committed = await db.$transaction(async (tx) => {
        const completed = await tx.order.updateMany({
          where: { id: orderId, refundProcessing: true, refundAmount: order.refundAmount },
          data: { refundProcessing: false },
        });
        if (!completed.count) return false;
        await refundOrderMembership(tx, orderId);
        for (const item of order.items) {
          if (item.productVariantId) {
            await tx.productVariant.update({
              where: { id: item.productVariantId },
              data: { stock: { increment: item.quantity } },
            });
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "REFUNDED",
            refundRequested: true,
            refundReason: reason || "Customer requested cancellation",
            refundAmount: order.total,
            refundedAt: new Date(),
            paywayRefundId,
            refundProcessing: false,
          },
        });
        await queueRefundReceipt(tx, orderId, Math.round(order.total * 100), order.total, true, false);
        return true;
      });
      if (!committed) return NextResponse.json({ success: true, autoRefunded: true, alreadyProcessed: true });

      return NextResponse.json({ success: true, autoRefunded: true, refundAmount: order.total });
    }

    // ── Post-ship: mark refund requested, admin decides ──────────────────────
    if (REFUND_REQUEST_STATUSES.includes(order.status)) {
      if (order.refundRequested) {
        return NextResponse.json({ error: "Refund request already submitted" }, { status: 400 });
      }

      if (!await requestReview()) return NextResponse.json({ error: "Order changed. Refresh and try again." }, { status: 409 });

      return NextResponse.json({ success: true, autoRefunded: false });
    }

    return NextResponse.json({ error: "Order status not eligible" }, { status: 400 });
  } catch (e) {
    console.error("[POST /api/orders/[id]/cancel]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
