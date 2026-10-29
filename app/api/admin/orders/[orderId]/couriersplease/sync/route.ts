import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { getCouriersPleaseTracking, isCouriersPleaseTestMode } from "@/lib/couriersplease";
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

    if (!order.trackingNumber) {
      return NextResponse.json(
        { error: "Order does not have a Couriers Please consignment/tracking number" },
        { status: 400 }
      );
    }

    // Already terminal delivered
    if (order.status === "DELIVERED") {
      return NextResponse.json({
        success: true,
        isDelivered: true,
        orderStatus: order.status,
        message: "Order is already marked as DELIVERED.",
      });
    }

    const trackingResult = await getCouriersPleaseTracking(order.trackingNumber);

    if (trackingResult?.isDelivered) {
      const prevStatus = order.status;
      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "DELIVERED",
            updatedAt: new Date(),
          },
        });

        await tx.emailJob.createMany({
          data: [
            {
              key: `order:${order.id}:status:DELIVERED:${randomUUID()}`,
              kind: "ORDER_STATUS",
              orderId: order.id,
              payload: {
                status: "DELIVERED",
                previousStatus: prevStatus,
                trackingNumber: order.trackingNumber || undefined,
                carrier: order.carrier || "Couriers Please",
              },
            },
          ],
          skipDuplicates: true,
        });
      });

      await processDueEmailJobs().catch((err) => {
        console.error("[Tracking sync] Email dispatch error:", err);
      });

      return NextResponse.json({
        success: true,
        updated: true,
        orderStatus: "DELIVERED",
        message: "Order marked as DELIVERED based on courier tracking! Customer notified.",
        tracking: trackingResult,
      });
    }

    return NextResponse.json({
      success: true,
      updated: false,
      orderStatus: order.status,
      isTestMode: isCouriersPleaseTestMode(),
      message: trackingResult?.status
        ? `Courier status: ${trackingResult.status}`
        : "Courier status checked: in transit",
      tracking: trackingResult,
    });
  } catch (error) {
    console.error("[CouriersPlease sync POST]", error);
    return NextResponse.json({ error: "Failed to check courier status" }, { status: 500 });
  }
}
