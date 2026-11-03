import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { couriersPleaseSenderFromEnv } from "@/lib/couriersplease";
import { selectPackagingPreset } from "@/lib/packaging";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ orderId: string }>;
}

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    const [order, packagingPresets] = await Promise.all([
      db.order.findUnique({
        where: { id: orderId },
        include: {
          address: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true, weight: true, length: true, width: true, height: true } },
              productVariant: { select: { weight: true, length: true, width: true, height: true } },
            },
          },
        },
      }),
      db.packagingPreset.findMany({
        where: { isActive: true },
        orderBy: [{ priority: "desc" }, { maxWeight: "asc" }],
      }),
    ]);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Resolve packaging box
    let packageName = order.packageName || "Standard Package";
    let length = order.packedLength || 30;
    let width = order.packedWidth || 25;
    let height = order.packedHeight || 20;
    let weight = order.packedWeight || 1.0;

    if (!order.packedLength || !order.packedWeight || !order.packageName) {
      const packagingItems = order.items.map((it) => ({
        quantity: it.quantity,
        weight: it.productVariant?.weight ?? it.product.weight ?? 0.5,
        length: it.productVariant?.length ?? it.product.length ?? 20,
        width: it.productVariant?.width ?? it.product.width ?? 15,
        height: it.productVariant?.height ?? it.product.height ?? 10,
        name: it.product.name,
      }));

      const calculated = await selectPackagingPreset(packagingItems, packagingPresets as any).catch(() => null);
      if (calculated) {
        packageName = calculated.packageName;
        length = calculated.length;
        width = calculated.width;
        height = calculated.height;
        weight = calculated.packedWeight;
      }
    }

    const cubicWeight = Math.round(((length * width * height) / 4000) * 100) / 100;

    let sender = {
      name: "Complete Home Solution",
      line1: "18 Edison Drive",
      suburb: "Golden Grove",
      state: "SA",
      postcode: "5125",
      phone: "0401 682 910",
      email: "info@completehomesollution.com.au",
    };
    try {
      const envSender = couriersPleaseSenderFromEnv();
      if (envSender) {
        sender = {
          name: envSender.name || sender.name,
          line1: envSender.line1 || sender.line1,
          suburb: envSender.suburb || sender.suburb,
          state: envSender.state || sender.state,
          postcode: envSender.postcode || sender.postcode,
          phone: envSender.phone || sender.phone,
          email: envSender.email || sender.email,
        };
      }
    } catch {
      // Fallback
    }

    const orderNumber = order.id.slice(-8).toUpperCase();
    let carrier = order.carrier || "Couriers Please";
    let serviceName = order.shippingServiceCode === "CP_EXPRESS" ? "EXPRESS AM PRIORITY" : "ROAD EXPRESS - TRACKED";
    let consignmentCode = order.trackingNumber || order.ship123OrderNo || `CP${order.address?.phone?.replace(/\D/g, "").slice(-8) || "98422999"}${orderNumber}`;
    let specialInstructions = "Safe drop permitted in a protected location.";

    let recipient = {
      name: order.address?.name || order.user?.name || "Customer",
      line1: order.address?.line1 || "Customer Address",
      line2: order.address?.line2 || null,
      suburb: order.address?.suburb || "Wollongong",
      state: order.address?.state || "WA",
      postcode: order.address?.postcode || "6410",
      phone: order.address?.phone || order.user?.phone || order.guestPhone || null,
      email: order.user?.email || order.guestEmail || null,
    };

    if (order.fulfillmentType === "STORE_PICKUP") {
      carrier = "CHS Store Pickup";
      serviceName = "WAREHOUSE COLLECTION DOCKET";
      consignmentCode = order.trackingNumber || `PK${orderNumber}`;
      const apptDate = order.pickupAppointmentDate
        ? new Date(order.pickupAppointmentDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
        : "Pending Schedule";
      const apptTime = order.pickupAppointmentTime || "";
      specialInstructions = `Store Pickup: ${apptDate} ${apptTime}. ${order.pickupNotes || "Customer pickup at Golden Grove showroom."}`.trim();
      recipient = {
        name: order.user?.name || order.address?.name || "Store Pickup Customer",
        line1: "Pickup: 18 Edison Drive (Showroom & Warehouse)",
        line2: "Customer Collection Counter",
        suburb: "Golden Grove",
        state: "SA",
        postcode: "5125",
        phone: order.address?.phone || order.user?.phone || order.guestPhone || null,
        email: order.user?.email || order.guestEmail || null,
      };
    } else if (order.fulfillmentType === "MANUAL_DELIVERY") {
      carrier = "CHS Local Delivery";
      serviceName = "DIRECT VAN DISPATCH - BULKY GOODS";
      consignmentCode = order.trackingNumber || `MD${orderNumber}`;
      specialInstructions = `Store Van Delivery. ${order.manualDeliveryNotes || "Bulky delivery. Driver to call customer upon arrival."}`.trim();
    }

    return NextResponse.json({
      orderId: order.id,
      orderNumber,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      carrier,
      serviceName,
      consignmentCode,
      trackingNumber: order.trackingNumber || consignmentCode,
      createdAt: order.createdAt.toISOString(),
      sender,
      recipient,
      parcel: {
        packageName,
        length,
        width,
        height,
        weight,
        cubicWeight,
        itemCount: order.items.reduce((s, it) => s + it.quantity, 0),
        items: order.items.map((it) => ({
          name: it.product.name,
          quantity: it.quantity,
          sku: it.product.sku,
        })),
        specialInstructions,
      },
      packagingPresets: packagingPresets.map((p) => ({
        id: p.id,
        name: p.name,
        length: p.length,
        width: p.width,
        height: p.height,
        maxWeight: p.maxWeight,
      })),
    });
  } catch (error) {
    console.error("[label-data route]", error);
    return NextResponse.json({ error: "Failed to load label data" }, { status: 500 });
  }
}
