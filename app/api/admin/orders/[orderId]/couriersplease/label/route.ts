import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import {
  getCouriersPleaseLabel,
  couriersPleaseSenderFromEnv,
  createCouriersPleaseShipment,
} from "@/lib/couriersplease";
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
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        address: true,
        user: { select: { name: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let consignmentNumber = order.trackingNumber || order.ship123OrderNo;
    let pdfBuffer: Buffer | null = null;

    // Auto-create shipment with Couriers Please if order doesn't have a consignment yet
    if (
      !consignmentNumber &&
      order.fulfillmentType !== "STORE_PICKUP" &&
      order.fulfillmentType !== "MANUAL_DELIVERY" &&
      order.address
    ) {
      try {
        const recipient = {
          name: order.address.name,
          line1: order.address.line1,
          line2: order.address.line2,
          suburb: order.address.suburb,
          state: order.address.state,
          postcode: order.address.postcode,
          phone: order.address.phone || order.user?.phone || null,
          email: order.user?.email || undefined,
        };
        const shipmentItems = [
          {
            quantity: 1,
            length: order.packedLength || 30,
            width: order.packedWidth || 25,
            height: order.packedHeight || 20,
            weight: order.packedWeight || 1.0,
            description: order.packageName ? `Box: ${order.packageName}` : "Packed Order",
          },
        ];
        const cpShipment = await createCouriersPleaseShipment({
          orderId: order.id,
          rateCardId: order.shippingServiceCode,
          recipient,
          items: shipmentItems,
          specialInstructions: "Safe drop permitted",
        });
        if (cpShipment?.consignmentCode) {
          consignmentNumber = cpShipment.consignmentCode;
          await db.order.update({
            where: { id: order.id },
            data: {
              trackingNumber: cpShipment.consignmentCode,
              carrier: "Couriers Please",
              status: order.status === "PAID" || order.status === "CONFIRMED" ? "PROCESSING" : order.status,
            },
          }).catch(() => null);
        }
      } catch (cpErr) {
        console.warn("[CouriersPlease label auto-create warning]", cpErr);
      }
    }

    if (consignmentNumber) {
      const base64Label = await getCouriersPleaseLabel(consignmentNumber).catch(() => null);
      if (base64Label) {
        pdfBuffer = Buffer.from(base64Label, "base64");
      }
    }

    // If external carrier label is not returned (e.g. simulation/test mode or offline), generate the standard vector label PDF
    if (!pdfBuffer) {
      const orderNumber = order.id.slice(-8).toUpperCase();
      const code = consignmentNumber || `CP${order.address?.phone?.replace(/\D/g, "").slice(-8) || "98422999"}${orderNumber}`;

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

      const length = order.packedLength || 30;
      const width = order.packedWidth || 25;
      const height = order.packedHeight || 20;

      const labelData: CourierLabelData = {
        orderId: order.id,
        orderNumber,
        carrier: order.carrier || "Couriers Please",
        serviceName: order.shippingServiceCode === "CP_EXPRESS" ? "EXPRESS AM PRIORITY" : "ROAD EXPRESS - TRACKED",
        trackingNumber: order.trackingNumber || code,
        consignmentCode: code,
        createdAt: order.createdAt,
        sender,
        recipient: {
          name: order.address?.name || order.user?.name || "Customer",
          line1: order.address?.line1 || "Customer Address",
          line2: order.address?.line2 || null,
          suburb: order.address?.suburb || "Wollongong",
          state: order.address?.state || "WA",
          postcode: order.address?.postcode || "6410",
          phone: order.address?.phone || order.user?.phone || order.guestPhone || null,
        },
        parcel: {
          packageName: order.packageName || "Standard Package",
          length,
          width,
          height,
          weight: order.packedWeight || 1.0,
          cubicWeight: Math.round(((length * width * height) / 4000) * 100) / 100,
          itemCount: order.items.reduce((s, it) => s + it.quantity, 0),
          specialInstructions: "Safe drop permitted",
        },
      };

      pdfBuffer = generateCourierLabelPdf(labelData);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="couriersplease-label-${order.id}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[CouriersPlease admin label GET]", error);
    return NextResponse.json({ error: "Failed to download Couriers Please shipping label" }, { status: 500 });
  }
}

