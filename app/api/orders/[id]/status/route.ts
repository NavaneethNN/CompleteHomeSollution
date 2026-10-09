import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { z } from "zod";
import { ORDER_TRANSITIONS } from "@/lib/order-state";

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]),
  trackingNumber: z.string().trim().max(200).nullable().optional(),
  carrier: z.string().trim().max(100).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    if (!await hasFreshAdminSession()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
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
    const allowedNext = ORDER_TRANSITIONS[existingOrder.status] ?? [];
    if (data.status !== existingOrder.status && !allowedNext.includes(data.status)) {
      return NextResponse.json(
        {
          error: `Cannot transition order from ${existingOrder.status} to ${data.status}. Allowed next statuses: ${allowedNext.length ? allowedNext.join(", ") : "none (terminal status)"}`,
        },
        { status: 422 }
      );
    }

    const changed = await db.$transaction(async tx => {
      const transition = await tx.order.updateMany({
      where: { id, status: existingOrder.status, refundProcessing: false, refundRequested: false },
      data: {
        status: data.status,
        ...(data.trackingNumber !== undefined ? { trackingNumber: data.trackingNumber } : {}),
        ...(data.carrier !== undefined ? { carrier: data.carrier } : {}),
        updatedAt: new Date(),
      },
    });

      if (transition.count && data.status !== existingOrder.status) {
        await tx.emailJob.createMany({ data: [{
          key: `order:${id}:status:${data.status}:${randomUUID()}`, kind: "ORDER_STATUS", orderId: id,
          payload: { status: data.status, previousStatus: existingOrder.status },
        }], skipDuplicates: true });
      }
      return transition;
    });

    if (!changed.count) return NextResponse.json({ error: "Order changed. Refresh and try again." }, { status: 409 });
    const order = await db.order.findUniqueOrThrow({ where: { id } });

    return NextResponse.json({ data: order });
  } catch (error) {
    console.error("[PUT /api/orders/[id]/status]", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
