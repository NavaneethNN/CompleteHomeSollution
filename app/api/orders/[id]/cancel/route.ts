import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { sendOrderCancellationEmail, sendRefundRequestEmail } from "@/lib/brevo";

// Statuses where we auto-refund immediately (order not yet shipped)
const AUTO_REFUND_STATUSES = ["PAID", "PROCESSING"];
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
    const { reason } = await req.json().catch(() => ({ reason: "" }));

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

    const email = order.user?.email ?? order.guestEmail;
    const name = order.user?.name ?? "Customer";

    // ── Pre-ship: auto-cancel + auto-refund via Stripe ──────────────────────
    if (AUTO_REFUND_STATUSES.includes(order.status)) {
      let stripeRefundId: string | null = null;

      if (order.stripePaymentId) {
        try {
          const refund = await getStripe().refunds.create({
            payment_intent: order.stripePaymentId,
            reason: "requested_by_customer",
          });
          stripeRefundId = refund.id;
        } catch (e) {
          console.error("[cancel] Stripe refund failed", e);
          return NextResponse.json({ error: "Refund failed — please contact support" }, { status: 502 });
        }
      }

      // Restore stock atomically
      await db.$transaction(async (tx) => {
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
            refundStripeId: stripeRefundId,
          },
        });
      });

      if (email) {
        sendOrderCancellationEmail({
          email,
          name,
          orderId: order.id,
          total: order.total,
          refundAmount: order.total,
          autoRefunded: true,
        }).catch((e) => console.error("[cancel] email failed", e));
      }

      return NextResponse.json({ success: true, autoRefunded: true, refundAmount: order.total });
    }

    // ── Post-ship: mark refund requested, admin decides ──────────────────────
    if (REFUND_REQUEST_STATUSES.includes(order.status)) {
      if (order.refundRequested) {
        return NextResponse.json({ error: "Refund request already submitted" }, { status: 400 });
      }

      await db.order.update({
        where: { id: orderId },
        data: {
          refundRequested: true,
          refundReason: reason || "Customer requested refund",
        },
      });

      if (email) {
        sendRefundRequestEmail({
          email,
          name,
          orderId: order.id,
          total: order.total,
          reason: reason || "Customer requested refund",
        }).catch((e) => console.error("[cancel] refund-request email failed", e));
      }

      return NextResponse.json({ success: true, autoRefunded: false });
    }

    return NextResponse.json({ error: "Order status not eligible" }, { status: 400 });
  } catch (e) {
    console.error("[POST /api/orders/[id]/cancel]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
