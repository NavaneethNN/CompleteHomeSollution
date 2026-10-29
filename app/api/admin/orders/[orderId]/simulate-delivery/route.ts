import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { processDueEmailJobs } from "@/lib/email-outbox";

export const runtime = "nodejs";

type Context = { params: Promise<{ orderId: string }> };

export async function POST(_req: NextRequest, { params }: Context) {
  try {
    if (!(await hasFreshAdminSession())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;
    if (!/^c[a-z0-9]{24,}$/.test(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true } },
        address: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "DELIVERED") {
      return NextResponse.json({
        success: true,
        alreadyDelivered: true,
        orderId: order.id,
        status: "DELIVERED",
        message: "Order is already marked as DELIVERED.",
      });
    }

    if (["CANCELLED", "REFUNDED"].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot mark a ${order.status} order as delivered.` },
        { status: 409 }
      );
    }

    const prevStatus = order.status;
    const newStatus = "DELIVERED";

    // 1. Update Order in DB & Enqueue Customer Delivered Notification
    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          carrier: order.carrier || "Couriers Please",
          updatedAt: new Date(),
        },
      });

      await tx.emailJob.createMany({
        data: [
          {
            key: `order:${order.id}:status:${newStatus}:${randomUUID()}`,
            kind: "ORDER_STATUS",
            orderId: order.id,
            payload: {
              status: newStatus,
              previousStatus: prevStatus,
              trackingNumber: order.trackingNumber || undefined,
              carrier: order.carrier || "Couriers Please",
            },
          },
        ],
        skipDuplicates: true,
      });
    });

    // 2. Dispatch email immediately (Vercel Free Plan compliant)
    await processDueEmailJobs().catch((err) => {
      console.error("[Simulate Delivery] Immediate email processing error:", err);
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      previousStatus: prevStatus,
      status: newStatus,
      message: "Order marked as DELIVERED by courier! Customer notification sent.",
    });
  } catch (error) {
    console.error("[Simulate Delivery POST]", error);
    return NextResponse.json({ error: "Failed to simulate delivery" }, { status: 500 });
  }
}

