import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { isCouriersPleaseTestMode } from "@/lib/couriersplease";
import { syncOrderWithCouriersPlease } from "@/lib/couriersplease-sync";

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
      select: {
        id: true,
        status: true,
        trackingNumber: true,
        carrier: true,
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

    if (["PENDING", "CANCELLED", "REFUNDED"].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot sync carrier tracking for ${order.status.toLowerCase()} order` },
        { status: 409 }
      );
    }

    // Already terminal delivered
    if (order.status === "DELIVERED") {
      return NextResponse.json({
        success: true,
        updated: false,
        isDelivered: true,
        orderStatus: order.status,
        message: "Order is already marked as DELIVERED.",
      });
    }

    const syncResult = await syncOrderWithCouriersPlease(order);
    const trackingResult = syncResult.tracking;

    if (syncResult.updated) {
      const milestoneLabel =
        syncResult.orderStatus === "DELIVERED"
          ? "DELIVERED"
          : syncResult.orderStatus === "OUT_FOR_DELIVERY"
          ? "OUT FOR DELIVERY"
          : syncResult.orderStatus;

      return NextResponse.json({
        success: true,
        updated: true,
        isDelivered: syncResult.orderStatus === "DELIVERED",
        orderStatus: syncResult.orderStatus,
        message: `Order updated to ${milestoneLabel} based on courier tracking! Customer notified.`,
        tracking: trackingResult,
      });
    }

    return NextResponse.json({
      success: true,
      updated: false,
      isDelivered: false,
      orderStatus: syncResult.orderStatus,
      isTestMode: isCouriersPleaseTestMode() || order.trackingNumber.startsWith("CPTEST-"),
      message: trackingResult?.status
        ? `Courier status: ${trackingResult.status}`
        : "No new carrier tracking events yet",
      tracking: trackingResult,
    });
  } catch (error) {
    console.error("[CouriersPlease sync POST]", error);
    return NextResponse.json({ error: "Failed to check courier status" }, { status: 500 });
  }
}
