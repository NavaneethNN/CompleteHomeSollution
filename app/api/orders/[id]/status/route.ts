import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";
import { sendOrderStatusNotification } from "@/lib/order-status-notifications";

// S-3: Order status state machine — defines valid forward transitions per status.
// Any transition not listed here is rejected.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING:          ["PAID", "CANCELLED"],
  PAID:             ["CONFIRMED", "PROCESSING", "CANCELLED", "REFUNDED"],
  CONFIRMED:        ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING:       ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED:          ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED:        ["REFUNDED"],
  CANCELLED:        [],   // terminal — no further transitions
  REFUNDED:         [],   // terminal — no further transitions
};

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED"]),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const data = updateStatusSchema.parse(body);

    const existingOrder = await db.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
        address: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // S-3: Enforce state machine — reject invalid transitions
    const allowedNext = ALLOWED_TRANSITIONS[existingOrder.status] ?? [];
    if (!allowedNext.includes(data.status)) {
      return NextResponse.json(
        {
          error: `Cannot transition order from ${existingOrder.status} to ${data.status}. Allowed next statuses: ${allowedNext.length ? allowedNext.join(", ") : "none (terminal status)"}`,
        },
        { status: 422 }
      );
    }

    // Require tracking info for shipped orders
    if (["SHIPPED", "OUT_FOR_DELIVERY"].includes(data.status)) {
      if (!data.trackingNumber || !data.carrier) {
        return NextResponse.json({
          error: "Tracking number and carrier are required for shipped orders",
        }, { status: 400 });
      }
    }

    const order = await db.order.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.trackingNumber !== undefined ? { trackingNumber: data.trackingNumber } : {}),
        ...(data.carrier !== undefined ? { carrier: data.carrier } : {}),
        updatedAt: new Date(),
      },
    });

    // Send email notification to customer
    const emailTarget = existingOrder.user?.email || existingOrder.guestEmail;
    const customerName = existingOrder.user?.name || "Valued Customer";
    try {
      if (emailTarget) {
        await sendOrderStatusNotification({
          orderId: order.id,
          orderNumber: order.id,
          customerName,
          customerEmail: emailTarget,
          newStatus: data.status,
          previousStatus: existingOrder.status,
          trackingNumber: data.trackingNumber,
          carrier: data.carrier,
          items: existingOrder.items.map((item) => ({
            productName: item.product.name,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
          total: order.total,
          shippingAddress: existingOrder.address
            ? { ...existingOrder.address, line2: existingOrder.address.line2 ?? undefined }
            : undefined,
        });
      }
    } catch (emailError) {
      console.error("[order status] Failed to send email notification:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({ data: order });
  } catch (error) {
    console.error("[PUT /api/orders/[id]/status]", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
