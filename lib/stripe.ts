import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const CURRENCY = "aud";

export async function createCheckoutSession(params: {
  lineItems: { price_data?: { currency: string; product_data: { name: string }; unit_amount: number }; quantity?: number }[];
  orderId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "payment",
    currency: CURRENCY,
    line_items: params.lineItems,
    customer_email: params.customerEmail,
    metadata: { orderId: params.orderId },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    shipping_address_collection: { allowed_countries: ["AU"] },
    payment_method_types: ["card"],
  });
}

export async function constructWebhookEvent(
  body: string,
  signature: string
): Promise<Stripe.Event> {
  return stripe.webhooks.constructEventAsync(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
