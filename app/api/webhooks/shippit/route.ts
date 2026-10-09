import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { queueShippingEmail } from "@/lib/email-outbox";
import { z } from "zod";

const eventSchema = z.object({
  retailer_invoice: z.string().trim().min(1).max(120),
  state: z.string().max(50),
  tracking_number: z.string().trim().min(1).max(200).optional(),
  courier_name: z.string().trim().min(1).max(120).optional(),
}).passthrough();

const dispatchedEventSchema = eventSchema.extend({
  state: z.literal("dispatched"),
  tracking_number: z.string().trim().min(1).max(200),
  courier_name: z.string().trim().min(1).max(120),
});

const SHIPPABLE_STATUSES = ["PAID", "CONFIRMED", "PROCESSING"] as const;

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
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const event = eventSchema.safeParse(json);
    if (!event.success) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    if (event.data.state !== "dispatched") {
      return NextResponse.json({ received: true });
    }

    const parsed = dispatchedEventSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    const { retailer_invoice: orderId, tracking_number, courier_name } = parsed.data;

    // The state predicate makes this transition atomic: delayed and replayed
    // events cannot revive pending, cancelled, refunded, or delivered orders.
    const transition = await db.$transaction(async tx => {
      const changed = await tx.order.updateMany({
      where: { id: orderId, status: { in: [...SHIPPABLE_STATUSES] } },
      data: {
        status: "SHIPPED",
        trackingNumber: tracking_number,
        carrier: courier_name,
      },
    });

      if (changed.count) await queueShippingEmail(tx, orderId);
      return changed;
    });

    if (transition.count === 0) {
      return NextResponse.json({ received: true, ignored: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Shippit webhook]", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
