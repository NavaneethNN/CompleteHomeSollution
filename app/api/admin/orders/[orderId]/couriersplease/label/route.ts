import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { getCouriersPleaseLabel } from "@/lib/couriersplease";

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
      select: {
        id: true,
        trackingNumber: true,
        ship123OrderNo: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const consignmentNumber = order.trackingNumber || order.ship123OrderNo;
    if (!consignmentNumber) {
      return NextResponse.json({ error: "Consignment number not found for this order" }, { status: 404 });
    }

    const base64Label = await getCouriersPleaseLabel(consignmentNumber);
    if (!base64Label) {
      return NextResponse.json({ error: "Shipping label is not yet available from Couriers Please" }, { status: 404 });
    }

    const pdfBuffer = Buffer.from(base64Label, "base64");

    return new NextResponse(pdfBuffer, {
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

