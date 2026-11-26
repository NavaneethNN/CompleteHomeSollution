import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { couriersPleaseSenderFromEnv } from "@/lib/couriersplease";
import { resolveOrderShipmentBoxes, parseStoredPackedBoxes } from "@/lib/shipping-packages";
import { generateCode128Svg } from "@/lib/barcode";
import { ShippingLabelView } from "@/components/admin/shipping-label-view";

export const metadata: Metadata = {
  title: "Courier Shipping Label — Admin",
};
export const dynamic = "force-dynamic";

interface LabelPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}

export default async function OrderShippingLabelPage({ params, searchParams }: LabelPageProps) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const { autoprint } = await searchParams;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      address: true,
      user: { select: { name: true, email: true, phone: true } },
      items: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              weight: true,
              length: true,
              width: true,
              height: true,
              extraPackages: true,
              requiresPackaging: true,
            },
          },
          productVariant: {
            select: {
              weight: true,
              length: true,
              width: true,
              height: true,
              extraPackages: true,
              requiresPackaging: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  // ── Packaging Box Specifications Resolution ─────────────────────────────
  const resolvedBoxes = await resolveOrderShipmentBoxes(order);
  const packageName = order.packageName || resolvedBoxes.packageName;
  const length = order.packedLength || resolvedBoxes.packedLength;
  const width = order.packedWidth || resolvedBoxes.packedWidth;
  const height = order.packedHeight || resolvedBoxes.packedHeight;
  const weight = order.packedWeight || resolvedBoxes.packedWeight;
  const boxes = resolvedBoxes.boxes;
  const totalBoxes = resolvedBoxes.totalBoxCount;

  if (!parseStoredPackedBoxes(order.packedBoxes).length && (!order.packedLength || !order.packedWeight || !order.packageName)) {
    // Auto-persist separate-box dimensions to DB
    await db.order
      .update({
        where: { id: order.id },
        data: {
          packagePresetId: resolvedBoxes.packagePresetId,
          packageName: resolvedBoxes.packageName,
          packedLength: resolvedBoxes.packedLength,
          packedWidth: resolvedBoxes.packedWidth,
          packedHeight: resolvedBoxes.packedHeight,
          packedWeight: resolvedBoxes.packedWeight,
          packedBoxes: boxes as unknown as import("@prisma/client").Prisma.InputJsonValue,
          packageOverride: false,
        },
      })
      .catch(() => null);
  }

  const cubicWeight =
    Math.round(boxes.reduce((sum, b) => sum + ((b.length * b.width * b.height) / 4000) * b.quantity, 0) * 100) / 100;

  // ── Sender Details ────────────────────────────────────────────────────────
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
    // Keep fallback sender
  }

  // ── Consignment & Barcode Code ────────────────────────────────────────────
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
    email: order.user?.email || order.guestEmail || null,
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
      email: order.user?.email || order.guestEmail || null,
    };
  } else if (order.fulfillmentType === "MANUAL_DELIVERY") {
    carrier = "CHS Local Delivery";
    serviceName = "DIRECT VAN DISPATCH - BULKY GOODS";
    consignmentCode = order.trackingNumber || `MD${orderNumber}`;
    specialInstructions = `Store Van Delivery. ${order.manualDeliveryNotes || "Large items delivery. Driver to call customer upon arrival."}`.trim();
  }

  const barcodeSvg = generateCode128Svg(consignmentCode, {
    height: 48,
    moduleWidth: 1.8,
    showText: false,
  });

  return (
    <ShippingLabelView
      orderId={order.id}
      orderNumber={orderNumber}
      carrier={carrier}
      serviceName={serviceName}
      trackingNumber={order.trackingNumber || consignmentCode}
      consignmentCode={consignmentCode}
      createdAt={order.createdAt.toISOString()}
      sender={sender}
      recipient={recipient}
      parcel={{
        packageName,
        length,
        width,
        height,
        weight,
        cubicWeight,
        totalBoxes,
        boxes,
        itemCount: order.items.reduce((s, it) => s + it.quantity, 0),
        itemNames: order.items.map((it) => `${it.quantity}x ${it.product.name}`),
        specialInstructions,
      }}
      barcodeSvg={barcodeSvg}
      autoPrint={autoprint === "1" || autoprint === "true"}
    />
  );
}
