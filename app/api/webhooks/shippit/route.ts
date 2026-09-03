import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { sendShippingUpdateEmail } from "@/lib/brevo";
import { sendShippingUpdateSms } from "@/lib/twilio";

/**
 * Verify Shippit webhook signature using HMAC-SHA256.
 * Shippit sends the signature as the X-Shippit-Hmac-SHA256 header.
 */
function verifyShippitSignature(body: string, signature: string): boolean {
  const secret = process.env.SHIPPIT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Shippit webhook] SHIPPIT_WEBHOOK_SECRET is not set");
    return false;
  }
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Read raw body for signature verification before JSON parsing
  const rawBody = await req.text();

  const signature = req.headers.get("x-shippit-hmac-sha256") ?? "";
  if (!verifyShippitSignature(rawBody, signature)) {
    console.warn("[Shippit webhook] Invalid or missing signature — request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody);
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
