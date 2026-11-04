import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { couriersPleaseSenderFromEnv } from "@/lib/couriersplease";
import { selectPackagingPreset } from "@/lib/packaging";
import { generateCourierLabelPdf, type CourierLabelData } from "@/lib/shipping-label-pdf";

type Context = { params: Promise<{ orderId: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  if (!(await hasFreshAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  if (!/^c[a-z0-9]{24,}$/.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const [order, packagingPresets] = await Promise.all([
      db.order.findUnique({
        where: { id: orderId },
        include: {
          address: true,
          user: { select: { name: true, email: true, phone: true } },
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

    if (order.status === "CANCELLED" || order.status === "REFUNDED" || order.status === "PENDING") {
      return NextResponse.json(
        { error: `Cannot generate shipping label for ${order.status.toLowerCase()} order` },
        { status: 400 }
      );
    }

    // ── Packaging Box Specifications Resolution ─────────────────────────────
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
        };
      }
    } catch {
      // Fallback
    }

    const orderNumber = order.id.slice(-8).toUpperCase();
    let carrier = order.carrier || "Couriers Please";
    let serviceName = order.shippingServiceCode === "CP_EXPRESS" ? "EXPRESS AM PRIORITY" : "ROAD EXPRESS - TRACKED";
    let consignmentCode = order.trackingNumber || order.ship123OrderNo || `CP${order.address?.phone?.replace(/\D/g, "").slice(-8) || "98422999"}${orderNumber}`;
    let specialInstructions = "Safe drop permitted";

    let recipient = {
      name: order.address?.name || order.user?.name || "Customer",
      line1: order.address?.line1 || "Customer Address",
      line2: order.address?.line2 || null,
      suburb: order.address?.suburb || "Wollongong",
      state: order.address?.state || "WA",
      postcode: order.address?.postcode || "6410",
      phone: order.address?.phone || order.user?.phone || order.guestPhone || null,
    };

    if (order.fulfillmentType === "STORE_PICKUP") {
      carrier = "CHS Store Pickup";
      serviceName = "WAREHOUSE COLLECTION DOCKET";
      consignmentCode = order.trackingNumber || `PK${orderNumber}`;
      const apptDate = order.pickupAppointmentDate
        ? new Date(order.pickupAppointmentDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
        : "Pending Appointment";
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
      };
    } else if (order.fulfillmentType === "MANUAL_DELIVERY") {
      carrier = "CHS Local Delivery";
      serviceName = "DIRECT VAN DISPATCH - BULKY GOODS";
      consignmentCode = order.trackingNumber || `MD${orderNumber}`;
      specialInstructions = `Store Van Delivery. ${order.manualDeliveryNotes || "Large items delivery. Driver to call customer upon arrival."}`.trim();
    }

    const labelData: CourierLabelData = {
      orderId: order.id,
      orderNumber,
      carrier,
      serviceName,
      trackingNumber: order.trackingNumber || consignmentCode,
      consignmentCode,
      createdAt: order.createdAt,
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
        specialInstructions,
      },
    };

    const pdfBuffer = generateCourierLabelPdf(labelData);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="courier-label-${orderNumber}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[shipping-label GET]", error);
    return NextResponse.json({ error: "Failed to generate shipping label" }, { status: 500 });
  }
}
