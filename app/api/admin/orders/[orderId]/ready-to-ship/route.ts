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
  isCouriersPleaseTestMode,
  CouriersPleaseError,
} from "@/lib/couriersplease";
import { getTrackingUrl } from "@/lib/tracking-url";
import { selectPackagingPreset } from "@/lib/packaging";

type Context = { params: Promise<{ orderId: string }> };

const bodySchema = z.object({
  readyDateTime: z.string().trim().optional(),
  specialInstructions: z.string().trim().max(140).optional(),
  packedLength: z.coerce.number().positive("Length must be greater than 0").max(300, "Length cannot exceed 300cm").optional(),
  packedWidth: z.coerce.number().positive("Width must be greater than 0").max(300, "Width cannot exceed 300cm").optional(),
  packedHeight: z.coerce.number().positive("Height must be greater than 0").max(300, "Height cannot exceed 300cm").optional(),
  packedWeight: z.coerce.number().positive("Weight must be greater than 0").max(100, "Weight cannot exceed 100kg").optional(),
});

async function orderForShipping(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      address: true,
      user: { select: { email: true, name: true, phone: true } },
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
    const order = await orderForShipping(orderId);

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

    // Calculate packaging dimensions and weight if not already set on the order
    let defaultPackaging = {
      packageName: order.packageName || "Standard Package",
      packedLength: order.packedLength || 30,
      packedWidth: order.packedWidth || 25,
      packedHeight: order.packedHeight || 20,
      packedWeight: order.packedWeight || 1.0,
      packageOverride: order.packageOverride || false,
    };

    if (!order.packedLength || !order.packedWeight) {
      const packagingItems = order.items.map((it) => ({
        quantity: it.quantity,
        weight: it.productVariant?.weight ?? it.product.weight ?? 0.5,
        length: it.productVariant?.length ?? it.product.length ?? 20,
        width: it.productVariant?.width ?? it.product.width ?? 15,
        height: it.productVariant?.height ?? it.product.height ?? 10,
        name: it.product.name,
      }));

      const calculated = await selectPackagingPreset(packagingItems).catch(() => null);
      if (calculated) {
        defaultPackaging = {
          packageName: calculated.packageName,
          packedLength: calculated.length,
          packedWidth: calculated.width,
          packedHeight: calculated.height,
          packedWeight: calculated.packedWeight,
          packageOverride: false,
        };
      } else {
        const netWeight = packagingItems.reduce((acc, it) => acc + (it.weight || 0.5) * it.quantity, 0);
        defaultPackaging.packedWeight = Math.round((netWeight + 0.2) * 100) / 100;
      }
    }

    const isBooked = !!order.trackingNumber && order.carrier?.toLowerCase().includes("couriers please");
    const trackingUrl = order.trackingNumber ? getTrackingUrl(order.carrier, order.trackingNumber) : null;

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        shippingServiceCode: order.shippingServiceCode,
        ship123OrderNo: order.ship123OrderNo,
        ship123LabelUrl: order.ship123LabelUrl,
        packageName: order.packageName || defaultPackaging.packageName,
        packedWeight: order.packedWeight || defaultPackaging.packedWeight,
        packedLength: order.packedLength || defaultPackaging.packedLength,
        packedWidth: order.packedWidth || defaultPackaging.packedWidth,
        packedHeight: order.packedHeight || defaultPackaging.packedHeight,
        packageOverride: order.packageOverride ?? defaultPackaging.packageOverride,
      },
      recipient: order.address
        ? {
            name: order.address.name,
            line1: order.address.line1,
            line2: order.address.line2,
            suburb: order.address.suburb,
            state: order.address.state,
            postcode: order.address.postcode,
          }
        : null,
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

  const { readyDateTime, specialInstructions, packedLength, packedWidth, packedHeight, packedWeight } = parsed.data;

  try {
    const order = await orderForShipping(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.address) {
      return NextResponse.json({ error: "Order is missing shipping delivery address" }, { status: 400 });
    }

    // Save newly confirmed dimensions & weight if provided by the admin
    if (packedLength && packedWidth && packedHeight && packedWeight) {
      const roundedLength = Math.round(packedLength * 10) / 10;
      const roundedWidth = Math.round(packedWidth * 10) / 10;
      const roundedHeight = Math.round(packedHeight * 10) / 10;
      const roundedWeight = Math.round(packedWeight * 100) / 100;

      await db.order.update({
        where: { id: order.id },
        data: {
          packedLength: roundedLength,
          packedWidth: roundedWidth,
          packedHeight: roundedHeight,
          packedWeight: roundedWeight,
          packageOverride: true,
        },
      });
      order.packedLength = roundedLength;
      order.packedWidth = roundedWidth;
      order.packedHeight = roundedHeight;
      order.packedWeight = roundedWeight;
      order.packageOverride = true;
    }

    if (order.fulfillmentType === "STORE_PICKUP" || order.fulfillmentType === "MANUAL_DELIVERY") {
      return NextResponse.json(
        { error: `Cannot book courier consignment for a ${order.fulfillmentType === "STORE_PICKUP" ? "Store Pickup" : "Manual Local Delivery"} order.` },
        { status: 409 }
      );
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
        packedLength: order.packedLength,
        packedWidth: order.packedWidth,
        packedHeight: order.packedHeight,
        packedWeight: order.packedWeight,
      });
    }

    const recipient = {
      name: order.address.name,
      line1: order.address.line1,
      line2: order.address.line2,
      suburb: order.address.suburb,
      state: order.address.state,
      postcode: order.address.postcode,
      phone: order.address.phone || order.user?.phone || order.guestPhone || "0400000000",
      email: order.user?.email || order.guestEmail,
    };

    // Calculate item list fallback if packaging box is not configured
    const items = order.items.map((item) => {
      const variant = item.productVariant;
      const weight = variant?.weight ?? item.product.weight ?? 1;
      const length = variant?.length ?? item.product.length ?? 20;
      const width = variant?.width ?? item.product.width ?? 15;
      const height = variant?.height ?? item.product.height ?? 10;

      return {
        quantity: item.quantity,
        length,
        width,
        height,
        weight,
        description: item.product.name,
      };
    });

    const consignmentItems = (order.packedLength && order.packedWidth && order.packedHeight && order.packedWeight)
      ? [
          {
            quantity: 1,
            length: order.packedLength,
            width: order.packedWidth,
            height: order.packedHeight,
            weight: order.packedWeight,
            description: order.packageName ? `Box: ${order.packageName}` : "Packed Order",
          },
        ]
      : items;

    // 1. Create shipment / consignment with Couriers Please
    const { consignmentCode } = await createCouriersPleaseShipment({
      orderId: order.id,
      rateCardId: order.shippingServiceCode,
      recipient,
      items: consignmentItems,
      specialInstructions,
    });

    // 2. Book courier pickup with the exact parcel count and weight
    let jobNumber = "";
    try {
      const totalItemCount = consignmentItems.reduce((acc, it) => acc + it.quantity, 0);
      const totalWeight = consignmentItems.reduce((acc, it) => acc + it.weight * it.quantity, 0);

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

    // Send shipment notification email immediately
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
      packedLength: order.packedLength,
      packedWidth: order.packedWidth,
      packedHeight: order.packedHeight,
      packedWeight: order.packedWeight,
    });
  } catch (error) {
    console.error("[CouriersPlease admin POST]", error);
    if (error instanceof CouriersPleaseError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to dispatch order with Couriers Please" }, { status: 500 });
  }
}
