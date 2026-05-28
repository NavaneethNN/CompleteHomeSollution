import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";
import { sendOrderStatusNotification } from "@/lib/order-status-notifications";

const updateStatusSchema = z.object({
  status: z.enum(["PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED"]),
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

    // Validate that the order exists and get complete data
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

    // Require tracking info for shipped orders
    if (["SHIPPED", "OUT_FOR_DELIVERY"].includes(data.status)) {
      if (!data.trackingNumber || !data.carrier) {
        return NextResponse.json({ 
          error: "Tracking number and carrier are required for shipped orders" 
        }, { status: 400 });
      }
    }

    // Update the order
    const order = await db.order.update({
      where: { id },
      data: {
        ...data,
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
          items: existingOrder.items.map(item => ({
            productName: item.product.name,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
          total: order.total,
          shippingAddress: existingOrder.address ? {
            ...existingOrder.address,
            line2: existingOrder.address.line2 ?? undefined,
          } : undefined,
        });
      }
    } catch (emailError) {
      console.error("[order status] Failed to send email notification:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({ data: order });
  } catch (error) {
    console.error("[PUT /api/orders/[id]/status]", error);
    
    if (error instanceof Error && error.message.includes("Cannot transition")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
