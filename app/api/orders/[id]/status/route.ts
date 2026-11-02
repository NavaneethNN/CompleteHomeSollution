import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { processDueEmailJobs } from "@/lib/email-outbox";
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

    if (existingOrder.refundRequested || existingOrder.refundProcessing) {
      return NextResponse.json(
        {
          error: `Cannot update order status while a refund is ${existingOrder.refundProcessing ? "processing" : "requested"}. Please resolve the refund request first.`,
        },
        { status: 409 }
      );
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
        ...(existingOrder.fulfillmentType === "STORE_PICKUP" && data.status === "DELIVERED"
          ? { pickupStatus: "PICKED_UP" }
          : {}),
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

    if (!changed.count) {
      const latest = await db.order.findUnique({
        where: { id },
        select: { status: true, refundRequested: true, refundProcessing: true },
      });
      if (latest?.refundRequested || latest?.refundProcessing) {
        return NextResponse.json(
          {
            error: `Cannot update order status: a refund is currently ${latest.refundProcessing ? "processing" : "requested"}. Please resolve the refund request first.`,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Order status or details were changed by another session. Refresh and try again." }, { status: 409 });
    }

    // Send status update notification immediately (fits within Vercel free plan)
    if (data.status !== existingOrder.status) {
      await processDueEmailJobs().catch((emailErr) => {
        console.error("[Order status update] Email dispatch note:", emailErr);
      });
    }

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
