import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import {
  getCouriersPleaseLabel,
  couriersPleaseSenderFromEnv,
  parseConsignmentCodes,
} from "@/lib/couriersplease";
import { resolveOrderShipmentBoxes } from "@/lib/shipping-packages";
import { generateCourierLabelPdf, type CourierLabelData } from "@/lib/shipping-label-pdf";

type Context = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, { params }: Context) {
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
            product: {
              select: {
                name: true,
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
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.fulfillmentType === "STORE_PICKUP" || order.fulfillmentType === "MANUAL_DELIVERY") {
      return NextResponse.json(
        { error: `Couriers Please labels do not apply to ${order.fulfillmentType === "STORE_PICKUP" ? "Store Pickup" : "Manual Local Delivery"} orders.` },
        { status: 409 }
      );
    }

    if (!["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot fetch Couriers Please label for ${order.status.toLowerCase()} order.` },
        { status: 409 }
      );
    }

    const rawConsignment = (order.trackingNumber || order.ship123OrderNo || "").trim();
    const consignmentCodes = parseConsignmentCodes(rawConsignment);
    if (consignmentCodes.length === 0) {
      return NextResponse.json(
        { error: "No Couriers Please consignment exists for this order yet. Book shipment via Ready to Ship first." },
        { status: 409 }
      );
    }

    const requestedCode = req.nextUrl.searchParams.get("code")?.trim();
    if (requestedCode && !consignmentCodes.includes(requestedCode)) {
      return NextResponse.json(
        { error: "Requested consignment code does not belong to this order." },
        { status: 404 }
      );
    }

    const activeConsignmentCode = requestedCode || (consignmentCodes.length === 1 ? consignmentCodes[0] : consignmentCodes.join(", "));

    let pdfBuffer: Buffer | null = null;
    if (requestedCode || consignmentCodes.length === 1) {
      const targetCode = requestedCode || consignmentCodes[0];
      const base64Label = await getCouriersPleaseLabel(targetCode).catch(() => null);
      if (base64Label) {
        const candidate = Buffer.from(base64Label, "base64");
        if (candidate.length > 100 && candidate.subarray(0, 4).toString("ascii") === "%PDF") {
          pdfBuffer = candidate;
        }
      }
    }

    // In simulation mode or if Couriers Please label asset is not yet ready, render vector PDF fallback
    if (!pdfBuffer) {
      const orderNumber = order.id.slice(-8).toUpperCase();

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

      const resolvedBoxes = await resolveOrderShipmentBoxes(order as Parameters<typeof resolveOrderShipmentBoxes>[0]);
      const length = order.packedLength || resolvedBoxes.packedLength;
      const width = order.packedWidth || resolvedBoxes.packedWidth;
      const height = order.packedHeight || resolvedBoxes.packedHeight;
      const weight = order.packedWeight || resolvedBoxes.packedWeight;
      const cubicWeight =
        Math.round(
          resolvedBoxes.boxes.reduce((sum, b) => sum + ((b.length * b.width * b.height) / 4000) * b.quantity, 0) * 100
        ) / 100;

      const labelData: CourierLabelData = {
        orderId: order.id,
        orderNumber,
        carrier: order.carrier || "Couriers Please",
        serviceName:
          order.shippingServiceCode && order.shippingServiceCode.toUpperCase().includes("EXPRESS")
            ? "EXPRESS AM PRIORITY"
            : "ROAD EXPRESS - TRACKED",
        trackingNumber: activeConsignmentCode,
        consignmentCode: activeConsignmentCode,
        createdAt: order.createdAt,
        sender,
        recipient: {
          name: order.address?.name || order.user?.name || "Customer",
          line1: order.address?.line1 || "",
          line2: order.address?.line2 || null,
          suburb: order.address?.suburb || "",
          state: order.address?.state || "",
          postcode: order.address?.postcode || "",
          phone: order.address?.phone || order.user?.phone || order.guestPhone || null,
        },
        parcel: {
          packageName: order.packageName || resolvedBoxes.packageName,
          length,
          width,
          height,
          weight,
          cubicWeight,
          totalBoxes: resolvedBoxes.totalBoxCount,
          boxes: resolvedBoxes.boxes,
          itemCount: order.items.reduce((s, it) => s + it.quantity, 0),
          specialInstructions: "Authority to leave if safe",
        },
      };

      pdfBuffer = generateCourierLabelPdf(labelData);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="couriersplease-label-${order.id}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[CouriersPlease admin label GET]", error);
    return NextResponse.json({ error: "Failed to download Couriers Please shipping label" }, { status: 500 });
  }
}

