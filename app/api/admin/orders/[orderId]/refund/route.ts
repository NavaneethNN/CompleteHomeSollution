import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { z } from "zod";
import { sendOrderCancellationEmail } from "@/lib/brevo";

const refundSchema = z.object({
  amount: z.number().positive(),   // amount in AUD dollars
  restoreStock: z.boolean().optional().default(false),
  manual: z.boolean().optional().default(false), // skip Stripe, just mark in DB
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
    if (amount > order.total) {
      return NextResponse.json({ error: `Refund amount cannot exceed order total (A$${order.total.toFixed(2)})` }, { status: 400 });
    }

    let stripeRefundId: string | null = null;

    if (!manual && order.stripePaymentId) {
      // Issue Stripe refund
      try {
        const refund = await getStripe().refunds.create({
          payment_intent: order.stripePaymentId,
          amount: Math.round(amount * 100), // cents
          reason: "requested_by_customer",
        });
        stripeRefundId = refund.id;
      } catch (e: any) {
        console.error("[admin refund] Stripe error", e);
        return NextResponse.json({ error: e?.message ?? "Stripe refund failed" }, { status: 502 });
      }
    } else if (!manual && !order.stripePaymentId) {
      return NextResponse.json({ error: "No Stripe payment ID — use manual refund" }, { status: 400 });
    }

    const isFullRefund = Math.abs(amount - order.total) < 0.01;

    await db.$transaction(async (tx) => {
      // Restore stock if requested
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
          refundAmount: amount,
          refundedAt: new Date(),
          ...(stripeRefundId ? { refundStripeId: stripeRefundId } : {}),
        },
      });
    });

    // Notify customer
    const email = order.user?.email ?? order.guestEmail;
    const name = order.user?.name ?? "Customer";
    if (email) {
      sendOrderCancellationEmail({
        email,
        name,
        orderId: order.id,
        total: order.total,
        refundAmount: amount,
        autoRefunded: false,
        isPartial: !isFullRefund,
      }).catch((e) => console.error("[admin refund] email failed", e));
    }

    return NextResponse.json({ success: true, refundAmount: amount, stripeRefundId, manual: !stripeRefundId });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
    }
    console.error("[POST /api/admin/orders/[orderId]/refund]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
