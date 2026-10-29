import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { processDueEmailJobs } from "@/lib/email-outbox";
import {
  checkCouriersPleaseAvailability,
  couriersPleaseSenderFromEnv,
  createCouriersPleaseShipment,
  bookCouriersPleasePickup,
  getCouriersPleaseLabel,
  isCouriersPleaseTestMode,
  CouriersPleaseError,
} from "@/lib/couriersplease";
import { getTrackingUrl } from "@/lib/tracking-url";

type Context = { params: Promise<{ orderId: string }> };

const bodySchema = z.object({
  readyDateTime: z.string().trim().optional(),
  specialInstructions: z.string().trim().max(140).optional(),
});

async function orderForShipping(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      address: true,
      user: { select: { email: true, name: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true, weight: true, length: true, width: true, height: true } },
          productVariant: { select: { weight: true, length: true, width: true, height: true } },
        },
      },
    },
  });
}

export async function GET(_req: NextRequest, { params }: Context) {
  if (!(await hasFreshAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  if (!/^c[a-z0-9]{24,}$/.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        carrier: true,
        trackingNumber: true,
        shippingServiceCode: true,
        ship123OrderNo: true,
        ship123LabelUrl: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const availability = checkCouriersPleaseAvailability();
    let sender = null;
    try {
      sender = couriersPleaseSenderFromEnv();
    } catch {
      // Ignore if not configured
    }

    const isBooked = !!order.trackingNumber && order.carrier?.toLowerCase().includes("couriers please");
    const trackingUrl = order.trackingNumber ? getTrackingUrl(order.carrier, order.trackingNumber) : null;

    return NextResponse.json({
      order,
      isBooked,
      isTestMode: isCouriersPleaseTestMode(),
      trackingUrl,
      availability,
      sender,
    });
  } catch (error) {
    console.error("[CouriersPlease admin GET]", error);
    return NextResponse.json({ error: "Failed to load order shipment details" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Context) {
  if (!(await hasFreshAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  if (!/^c[a-z0-9]{24,}$/.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  const { readyDateTime, specialInstructions } = parsed.data;

  try {
    const order = await orderForShipping(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!["PAID", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(order.status) || !order.items.length) {
      return NextResponse.json(
        { error: "Only paid physical orders can be dispatched with Couriers Please" },
        { status: 409 }
      );
    }

    // If order was already dispatched and has tracking, avoid duplicate booking
    if (order.trackingNumber && order.carrier?.toLowerCase().includes("couriers please")) {
      const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber);
      return NextResponse.json({
        alreadyBooked: true,
        consignmentCode: order.trackingNumber,
        trackingNumber: order.trackingNumber,
        labelUrl: order.ship123LabelUrl || `/api/admin/orders/${order.id}/couriersplease/label`,
        trackingUrl,
        message: "Order already booked with Couriers Please",
      });
    }

    const recipient = {
      name: order.address.name,
      line1: order.address.line1,
      line2: order.address.line2,
      suburb: order.address.suburb,
      state: order.address.state,
      postcode: order.address.postcode,
      phone: order.address.phone || order.guestPhone,
      email: order.user?.email || order.guestEmail,
    };

    let totalItemCount = 0;
    let totalWeight = 0;

    const items = order.items.map((item) => {
      const variant = item.productVariant;
      const weight = variant?.weight ?? item.product.weight ?? 1;
      const length = variant?.length ?? item.product.length ?? 20;
      const width = variant?.width ?? item.product.width ?? 15;
      const height = variant?.height ?? item.product.height ?? 10;

      totalItemCount += item.quantity;
      totalWeight += weight * item.quantity;

      return {
        quantity: item.quantity,
        length,
        width,
        height,
        weight,
        description: item.product.name,
      };
    });

    // 1. Create shipment / consignment with Couriers Please
    const { consignmentCode } = await createCouriersPleaseShipment({
      orderId: order.id,
      rateCardId: order.shippingServiceCode,
      recipient,
      items,
      specialInstructions,
    });

    // 2. Book courier pickup
    let jobNumber = "";
    try {
      const pickupResult = await bookCouriersPleasePickup({
        consignmentCode,
        readyDateTime,
        totalItemCount,
        totalWeight,
        specialInstructions,
      });
      jobNumber = pickupResult.jobNumber;
    } catch (pickupErr) {
      console.error("[CouriersPlease] Pickup booking note:", pickupErr);
      // Even if pickup booking encounters a temporary warning, consignment is already created
    }

    const labelUrl = `/api/admin/orders/${order.id}/couriersplease/label`;

    // 3. Update Order in DB with Couriers Please details & mark as SHIPPED
    const prevStatus = order.status;
    const newStatus = "SHIPPED";

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          carrier: "Couriers Please",
          trackingNumber: consignmentCode,
          ship123OrderNo: consignmentCode,
          ship123LabelUrl: labelUrl,
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      // Enqueue order status update email & SMS if status changed
      if (prevStatus !== newStatus) {
        await tx.emailJob.createMany({
          data: [
            {
              key: `order:${order.id}:status:${newStatus}:${randomUUID()}`,
              kind: "ORDER_STATUS",
              orderId: order.id,
              payload: {
                status: newStatus,
                previousStatus: prevStatus,
                trackingNumber: consignmentCode,
                carrier: "Couriers Please",
              },
            },
          ],
          skipDuplicates: true,
        });
      }
    });

    // Send shipment notification email immediately (fits within Vercel free plan)
    await processDueEmailJobs().catch((emailErr) => {
      console.error("[CouriersPlease ready-to-ship] Email dispatch note:", emailErr);
    });

    const trackingUrl = getTrackingUrl("Couriers Please", consignmentCode);

    return NextResponse.json({
      success: true,
      consignmentCode,
      trackingNumber: consignmentCode,
      jobNumber,
      labelUrl,
      trackingUrl,
    });
  } catch (error) {
    console.error("[CouriersPlease admin POST]", error);
    if (error instanceof CouriersPleaseError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to dispatch order with Couriers Please" }, { status: 500 });
  }
}

