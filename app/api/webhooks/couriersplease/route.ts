import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processDueEmailJobs } from "@/lib/email-outbox";
import { isCouriersPleaseTestMode, getCouriersPleaseEnv } from "@/lib/couriersplease";

export const runtime = "nodejs";

/**
 * Normalizes courier status string into our internal OrderStatus.
 * Handles variations like:
 * - "DELIVERED", "Delivered", "DEL", "POD", "Delivered to recipient", "Delivered with Authority to Leave"
 * - "OUT_FOR_DELIVERY", "Out for Delivery", "With Driver", "On Van"
 * - "IN_TRANSIT", "In Transit", "Picked Up", "Collected"
 */
function normalizeCourierStatus(statusRaw: string): "DELIVERED" | "OUT_FOR_DELIVERY" | "SHIPPED" | null {
  const s = statusRaw.toLowerCase().trim().replace(/[-_\s]+/g, " ");

  if (
    s === "delivered" ||
    s.startsWith("deliver") ||
    s.includes("pod") ||
    s.includes("delivered to") ||
    s.includes("safe drop completed") ||
    s.includes("delivery completed")
  ) {
    return "DELIVERED";
  }

  if (
    s === "out for delivery" ||
    s.includes("out for delivery") ||
    s.includes("with driver") ||
    s.includes("on van") ||
    s.includes("on vehicle for delivery")
  ) {
    return "OUT_FOR_DELIVERY";
  }

  if (
    s === "in transit" ||
    s.includes("transit") ||
    s.includes("picked up") ||
    s.includes("collected") ||
    s.includes("depot scan") ||
    s.includes("sorting")
  ) {
    return "SHIPPED";
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Optional Secret Verification
    const configuredSecret = getCouriersPleaseEnv("COURIERS_PLEASE_WEBHOOK_SECRET", [
      "COURIER_PLEASE_WEBHOOK_SECRET",
    ]);

    if (configuredSecret) {
      const headerSecret =
        req.headers.get("x-couriersplease-secret") ||
        req.headers.get("x-webhook-secret") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      const querySecret = req.nextUrl.searchParams.get("secret");
      const providedSecret = headerSecret || querySecret;

      if (providedSecret !== configuredSecret) {
        console.warn("[CouriersPlease Webhook] Unauthorized access attempt: invalid secret");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 2. Parse Payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Extract tracking/consignment number or order reference from various webhook formats
    const consignmentNumber: string | undefined =
      body?.consignmentNumber ||
      body?.consignment_number ||
      body?.trackingNumber ||
      body?.tracking_number ||
      body?.data?.tracking_number ||
      body?.consignment ||
      body?.code;

    const orderReference: string | undefined =
      body?.orderId ||
      body?.order_id ||
      body?.referenceNumber ||
      body?.reference_number ||
      body?.reference ||
      body?.retailer_invoice ||
      body?.data?.order_id;

    const rawStatus: string | undefined =
      body?.status ||
      body?.state ||
      body?.tag ||
      body?.event ||
      body?.event_type ||
      body?.description ||
      body?.data?.tag ||
      body?.data?.status;

    if (!consignmentNumber && !orderReference) {
      return NextResponse.json(
        { error: "Missing consignmentNumber or orderReference in webhook payload" },
        { status: 400 }
      );
    }

    if (!rawStatus) {
      return NextResponse.json(
        { error: "Missing status in webhook payload" },
        { status: 400 }
      );
    }

    const normalizedStatus = normalizeCourierStatus(String(rawStatus));
    if (!normalizedStatus) {
      // Ignored informational events (e.g. "Manifest Created", "Label Generated")
      return NextResponse.json({
        received: true,
        ignored: true,
        rawStatus,
        message: "Status does not trigger an order transition",
      });
    }

    // 3. Find Order in Database
    const order = await db.order.findFirst({
      where: {
        OR: [
          ...(consignmentNumber
            ? [
                { trackingNumber: consignmentNumber },
                { ship123OrderNo: consignmentNumber },
              ]
            : []),
          ...(orderReference
            ? [
                { id: orderReference },
                { id: { endsWith: orderReference.replace(/^CHS-/, "") } },
              ]
            : []),
        ],
      },
      include: {
        user: { select: { email: true, name: true } },
        address: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          error: "Order not found",
          consignmentNumber,
          orderReference,
        },
        { status: 404 }
      );
    }

    // If order is already in target status or terminal delivered
    if (order.status === normalizedStatus) {
      return NextResponse.json({
        received: true,
        alreadyProcessed: true,
        orderId: order.id,
        currentStatus: order.status,
      });
    }

    // If order was already DELIVERED, don't revert to earlier status (e.g. out of order webhook)
    if (order.status === "DELIVERED") {
      return NextResponse.json({
        received: true,
        ignored: true,
        orderId: order.id,
        message: "Order already delivered",
      });
    }

    // Only transition orders that have been paid/confirmed/shipped
    const eligibleStatuses = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"];
    if (!eligibleStatuses.includes(order.status)) {
      return NextResponse.json({
        received: true,
        ignored: true,
        orderId: order.id,
        message: `Order status ${order.status} is not eligible for delivery update`,
      });
    }

    const prevStatus = order.status;

    // 4. Update Order Status & Queue Email Notification
    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: normalizedStatus,
          carrier: order.carrier || "Couriers Please",
          ...(consignmentNumber && !order.trackingNumber ? { trackingNumber: consignmentNumber } : {}),
          updatedAt: new Date(),
        },
      });

      // Queue status update notification (e.g. Order Delivered or Out for Delivery)
      await tx.emailJob.createMany({
        data: [
          {
            key: `order:${order.id}:status:${normalizedStatus}:${randomUUID()}`,
            kind: "ORDER_STATUS",
            orderId: order.id,
            payload: {
              status: normalizedStatus,
              previousStatus: prevStatus,
              trackingNumber: consignmentNumber || order.trackingNumber || undefined,
              carrier: order.carrier || "Couriers Please",
            },
          },
        ],
        skipDuplicates: true,
      });
    });

    // 5. Send Email Immediately (Optimized for Vercel Free Plan without requiring frequent cron)
    await processDueEmailJobs().catch((emailErr) => {
      console.error("[CouriersPlease Webhook] Immediate email dispatch error:", emailErr);
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      previousStatus: prevStatus,
      newStatus: normalizedStatus,
      isTestMode: isCouriersPleaseTestMode(),
      message: `Order updated to ${normalizedStatus} and customer notified`,
    });
  } catch (error) {
    console.error("[CouriersPlease Webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

