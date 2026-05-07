import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendShippingUpdateEmail } from "@/lib/brevo";
import { sendShippingUpdateSms } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { retailer_invoice: orderId, tracking_number, courier_name, state } = body;

    if (state !== "dispatched") {
      return NextResponse.json({ received: true });
    }

    const order = await db.order.update({
      where: { id: orderId },
      data: {
        status: "SHIPPED",
        trackingNumber: tracking_number,
        carrier: courier_name,
      },
      include: { user: true, address: true },
    });

    const email = order.user?.email ?? order.guestEmail;
    const name = order.user?.name ?? "Customer";
    const phone = order.user?.phone ?? order.guestPhone;

    if (email) {
      await sendShippingUpdateEmail({
        email,
        name,
        orderId: order.id,
        trackingNumber: tracking_number,
        carrier: courier_name,
      }).catch((e) => console.error("Shipping email failed", e));
    }

    if (phone) {
      await sendShippingUpdateSms(phone, order.id, tracking_number, courier_name).catch(
        (e) => console.error("Shipping SMS failed", e)
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Shippit webhook]", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
