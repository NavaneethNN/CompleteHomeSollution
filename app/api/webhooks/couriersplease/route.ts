import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processDueEmailJobs } from "@/lib/email-outbox";
import {
  classifyCouriersPleaseStatus,
  getCouriersPleaseEnv,
  isCouriersPleaseTestMode,
} from "@/lib/couriersplease";

export const runtime = "nodejs";

const STATUS_RANK: Record<string, number> = {
  PAID: 1,
  CONFIRMED: 1,
  PROCESSING: 1,
  SHIPPED: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
};

function secretsMatch(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function normalizeCourierStatus(statusRaw: string): "DELIVERED" | "OUT_FOR_DELIVERY" | "SHIPPED" | null {
  return classifyCouriersPleaseStatus(statusRaw).normalizedStatus;
}

function firstNonEmptyString(...candidates: Array<unknown>): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Secret Verification (required in production; optional only in local dev/test when unset)
    const configuredSecret = getCouriersPleaseEnv("COURIERS_PLEASE_WEBHOOK_SECRET", [
      "COURIER_PLEASE_WEBHOOK_SECRET",
    ]);

    if (!configuredSecret && process.env.NODE_ENV === "production") {
      console.error("[CouriersPlease Webhook] COURIERS_PLEASE_WEBHOOK_SECRET is not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (configuredSecret) {
      const headerSecret =
        req.headers.get("x-couriersplease-secret") ||
        req.headers.get("x-webhook-secret") ||
        req.headers.get("x-api-key") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      const querySecret = req.nextUrl.searchParams.get("secret");
      const providedSecret = headerSecret || querySecret;

      if (!secretsMatch(providedSecret, configuredSecret)) {
        console.warn("[CouriersPlease Webhook] Unauthorized access attempt: invalid secret");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 2. Parse Payload
    type WebhookBody = Record<string, unknown> & {
      data?: Record<string, unknown> & {
        consignmentInfo?: Array<Record<string, unknown>>;
      };
    };
    let body: WebhookBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const consignmentInfo = Array.isArray(body?.data?.consignmentInfo) ? body.data.consignmentInfo[0] : undefined;

    // Extract tracking/consignment number or order reference from various webhook formats
    const consignmentNumber = firstNonEmptyString(
      body?.consignmentNumber,
      body?.consignment_number,
      body?.consignmentCode,
      body?.ConsignmentCode,
      body?.trackingNumber,
      body?.tracking_number,
      body?.trackingCode,
      body?.TrackingCode,
      body?.data?.consignmentCode,
      body?.data?.consignmentNumber,
      body?.data?.tracking_number,
      consignmentInfo?.consignmentCode,
      body?.consignment,
      body?.code
    );

    const orderReference = firstNonEmptyString(
      body?.orderId,
      body?.order_id,
      body?.referenceNumber,
      body?.ReferenceNumber,
      body?.reference_number,
      body?.reference,
      body?.retailer_invoice,
      body?.data?.order_id,
      body?.data?.referenceNumber
    );

    const rawStatus = firstNonEmptyString(
      body?.status,
      body?.state,
      body?.tag,
      body?.event,
      body?.event_type,
      body?.action,
      body?.description,
      body?.data?.tag,
      body?.data?.status,
      consignmentInfo?.status
    );

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

    const normalizedStatus = normalizeCourierStatus(rawStatus);
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
    const strippedRef = orderReference ? orderReference.replace(/^CHS-/, "") : "";
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
                ...(strippedRef.length >= 8 ? [{ id: { endsWith: strippedRef } }] : []),
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

    // Only transition orders that have been paid/confirmed/shipped and only advance forward monotonically
    const eligibleStatuses = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"];
    if (!eligibleStatuses.includes(order.status)) {
      return NextResponse.json({
        received: true,
        ignored: true,
        orderId: order.id,
        message: `Order status ${order.status} is not eligible for delivery update`,
      });
    }

    if ((STATUS_RANK[normalizedStatus] ?? 0) <= (STATUS_RANK[order.status] ?? 0)) {
      return NextResponse.json({
        received: true,
        ignored: true,
        orderId: order.id,
        currentStatus: order.status,
        message: `Order already at or past ${normalizedStatus} (${order.status})`,
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

