import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { refundTransaction, PayWayApiError } from "@/lib/payway";
import { z } from "zod";
import { sendOrderCancellationEmail } from "@/lib/brevo";

const refundSchema = z.object({
  amount: z.number().positive(),
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
    if (amount > order.total) {
      return NextResponse.json(
        { error: `Refund amount cannot exceed order total (A$${order.total.toFixed(2)})` },
        { status: 400 }
      );
    }

    const isFullRefund = Math.abs(amount - order.total) < 0.01;

    // Step 1 — commit DB changes first
    await db.$transaction(async (tx) => {
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
        },
      });
    });

    // Step 2 — issue PayWay refund
    let paywayRefundId: string | null = null;

    if (!manual && order.paywayTransactionId) {
      try {
        const refundTxn = await refundTransaction({
          parentTransactionId: order.paywayTransactionId,
          principalAmount: amount,
          orderNumber: order.id,
        });
        paywayRefundId = String(refundTxn.transactionId);
      } catch (err) {
        // DB already updated — log and return 502 so admin knows to process manually
        console.error(
          "[admin refund] PayWay refund error — DB already updated, manual follow-up required",
          err
        );
        const msg =
          err instanceof PayWayApiError
            ? (err.errors[0]?.message ?? err.message)
            : "PayWay refund failed";
        return NextResponse.json(
          {
            error: `Order marked refunded in DB but PayWay refund failed: ${msg}. Please process manually.`,
            paywayRefundId: null,
            manual: true,
          },
          { status: 502 }
        );
      }
    } else if (!manual && !order.paywayTransactionId) {
      console.warn(
        `[admin refund] No paywayTransactionId for order ${orderId} — manual refund only`
      );
    }

    // Step 3 — save PayWay refund transaction ID
    if (paywayRefundId) {
      await db.order.update({
        where: { id: orderId },
        data: { paywayRefundId },
      });
    }

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
