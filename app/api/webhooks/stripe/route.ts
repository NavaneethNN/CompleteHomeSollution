import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/brevo";
import { sendOrderConfirmationSms, sendOrderWhatsApp } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    event = await constructWebhookEvent(body, signature);
  } catch (err) {
    console.error("[Stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;

      if (!orderId) return NextResponse.json({ received: true });

      const order = await db.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          stripePaymentId: session.payment_intent as string,
        },
        include: {
          items: { include: { product: { select: { name: true } } } },
          address: true,
          user: true,
        },
      });

      const email = order.user?.email ?? order.guestEmail;
      const name = order.user?.name ?? "Customer";
      const phone = order.user?.phone ?? order.guestPhone;

      if (email) {
        await sendOrderConfirmationEmail({
          email,
          name,
          orderId: order.id,
          total: order.total,
          items: order.items.map((i: { product: { name: string }; quantity: number; unitPrice: number }) => ({
            name: i.product.name,
            quantity: i.quantity,
            price: i.unitPrice,
          })),
        }).catch((e) => console.error("Email send failed", e));
      }

      if (phone) {
        await sendOrderConfirmationSms(phone, order.id, order.total).catch(
          (e) => console.error("SMS send failed", e)
        );
        await sendOrderWhatsApp(phone, order.id, order.total).catch(
          (e) => console.error("WhatsApp send failed", e)
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe webhook] processing error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export const config = { api: { bodyParser: false } };
