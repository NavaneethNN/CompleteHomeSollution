import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { refundTransaction, PayWayApiError } from "@/lib/payway";
import { refundOnlinePayOrder, OnlinePayRefundError } from "@/lib/onlinepay";
import { refundOrderMembership } from "@/lib/membership";
import { z } from "zod";
import { queueRefundReceipt } from "@/lib/email-outbox";

const refundSchema = z.object({
  amount: z.number().positive().refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, "Use whole cents"),
  restoreStock: z.boolean().optional().default(false),
  manual: z.boolean().optional().default(false), // skip PayWay call, just mark in DB
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { orderId } = await params;
    const body = await req.json();
    const { amount, restoreStock, manual } = refundSchema.parse(body);

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status === "REFUNDED") {
      return NextResponse.json({ error: "Order already refunded" }, { status: 400 });
    }
    if (order.status === "PENDING") return NextResponse.json({ error: "Verify payment before refunding." }, { status: 409 });
    if (!manual && !order.paywayTransactionId) {
      return NextResponse.json({ error: "Refund this payment in its provider dashboard, then record it using manual mode." }, { status: 422 });
    }
    const alreadyRefunded = order.refundAmount ?? 0;
    if (amount > Math.round((order.total - alreadyRefunded) * 100) / 100) {
      return NextResponse.json(
        { error: `Refund amount cannot exceed order total (A$${order.total.toFixed(2)})` },
        { status: 400 }
      );
    }

    const isFullRefund = Math.abs(amount + alreadyRefunded - order.total) < 0.01;
    if (restoreStock && (!isFullRefund || order.status === "CANCELLED")) return NextResponse.json({ error: "Stock can only be restored with a full refund of a fulfilled payment." }, { status: 400 });
    const resuming = !manual && order.paywayTransactionId?.startsWith("ONLINEPAY:") && order.refundProcessing &&
      order.refundAttemptAmount === amount && order.refundAttemptRestoreStock === restoreStock;
    const claimed = resuming ? { count: 1 } : await db.order.updateMany({
      where: { id: orderId, status: order.status, refundProcessing: false, refundAmount: order.refundAmount },
      data: { refundProcessing: true, refundAttemptAmount: manual ? null : amount, refundAttemptRestoreStock: restoreStock },
    });
    if (!claimed.count) return NextResponse.json({ error: "Refund is already processing or the order changed. Refresh before continuing." }, { status: 409 });

    // Submit the provider refund before changing stock or membership. Unknown
    // outcomes retain the claim and exact retry parameters for reconciliation.
    let paywayRefundId: string | null = null;

    if (!manual && order.paywayTransactionId) {
      // Step 1 — issue PayWay refund first
      try {
        const refundTxn = order.paywayTransactionId.startsWith("ONLINEPAY:")
          ? await refundOnlinePayOrder({ checkoutId: order.paywayTransactionId.slice(10), orderId, orderTotal: order.total, amount, refundedBefore: alreadyRefunded })
          : await refundTransaction({
          parentTransactionId: order.paywayTransactionId,
          principalAmount: amount,
          orderNumber: order.id,
          refundedBefore: alreadyRefunded,
        });
        if (refundTxn.status !== "approved" && refundTxn.status !== "approved*") {
          if (refundTxn.status === "declined" || refundTxn.status === "voided") {
            await db.order.update({ where: { id: orderId }, data: { refundProcessing: false } });
          }
          return NextResponse.json({ error: "Refund is not confirmed. Check the provider before retrying." }, { status: 409 });
        }
        paywayRefundId = String(refundTxn.transactionId);
      } catch (err) {
        if (err instanceof OnlinePayRefundError && err.safeToRetry) await db.order.update({ where: { id: orderId }, data: { refundProcessing: false } });
        // Unknown outcomes retain the claim; OnlinePay retries reuse the same provider key.
        console.error("[admin refund] Provider refund not confirmed", err);
        const msg =
          err instanceof PayWayApiError
            ? (err.errors[0]?.message ?? err.message)
            : "Payment provider refund failed";
        return NextResponse.json(
          { error: `Refund could not be processed: ${msg}. Check the provider before retrying; retry the same amount and stock option to reconcile an OnlinePay refund.` },
          { status: 502 }
        );
      }
    } else if (!manual && !order.paywayTransactionId) {
      console.warn(
        `[admin refund] No paywayTransactionId for order ${orderId} — treating as manual refund`
      );
    }

    // Step 2 — PayWay succeeded (or was skipped): commit DB changes atomically
    try {
      const committed = await db.$transaction(async (tx) => {
        const completed = await tx.order.updateMany({
          where: { id: orderId, refundProcessing: true, refundAmount: order.refundAmount },
          data: { refundProcessing: false },
        });
        if (!completed.count) return false;
        if (isFullRefund) await refundOrderMembership(tx, orderId);
        if (restoreStock) {
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
        }
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: isFullRefund ? "REFUNDED" : order.status,
            refundRequested: false,
            refundAmount: Math.round((amount + alreadyRefunded) * 100) / 100,
            refundProcessing: false,
            refundedAt: new Date(),
            // Store PayWay refund ID in same transaction so it's atomic
            ...(paywayRefundId ? { paywayRefundId } : {}),
          },
        });
        await queueRefundReceipt(tx, orderId, Math.round((amount + alreadyRefunded) * 100), amount, false, !isFullRefund);
        return true;
      });
      if (!committed) return NextResponse.json({ success: true, alreadyProcessed: true });
    } catch (dbErr) {
      // DB failed AFTER PayWay already processed the refund.
      // The customer HAS received their money. Log clearly for ops to fix the
      // DB state manually — do NOT retry the PayWay refund.
      console.error(
        `[admin refund] CRITICAL: PayWay refund ${paywayRefundId} succeeded for order ` +
          `${orderId} but DB update failed. Manual DB correction required.`,
        dbErr
      );
      return NextResponse.json(
        {
          error:
            "Payment provider refund was processed successfully but the order record could not be updated. " +
            (order.paywayTransactionId?.startsWith("ONLINEPAY:")
              ? "Retry the same amount and stock option to reconcile safely."
              : "Contact support to reconcile the order record."),
          paywayRefundId,
          requiresManualDbFix: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refundAmount: amount,
      paywayRefundId,
      manual: !paywayRefundId,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
    }
    console.error("[POST /api/admin/orders/[orderId]/refund]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
