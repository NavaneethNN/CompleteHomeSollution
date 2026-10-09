import { createHmac, timingSafeEqual } from "node:crypto";

type ShippingQuotePayload = {
  postcode: string;
  shipmentKey: string;
  serviceCode: string;
  priceCents: number;
  expires: number;
};

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Shipping quote signing secret is not configured");
  return secret;
}

function encodePayload(payload: ShippingQuotePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", signingSecret()).update(`shipping-quote:${encodedPayload}`).digest("hex");
}

export function createShippingQuoteToken(input: {
  postcode: string;
  shipmentKey: string;
  serviceCode: string;
  price: number;
  now?: number;
}): string {
  const payload: ShippingQuotePayload = {
    postcode: input.postcode,
    shipmentKey: input.shipmentKey,
    serviceCode: input.serviceCode,
    priceCents: Math.round(input.price * 100),
    expires: Math.floor((input.now ?? Date.now()) / 1000) + 10 * 60,
  };
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyShippingQuoteToken(input: {
  token: string | null | undefined;
  postcode: string;
  shipmentKey: string;
  serviceCode: string | null | undefined;
  price: number | null | undefined;
  now?: number;
}): boolean {
  if (!input.token || !input.serviceCode || input.price == null) return false;
  const [encodedPayload, signature] = input.token.split(".");
  if (!encodedPayload || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;

  let payload: ShippingQuotePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as ShippingQuotePayload;
  } catch {
    return false;
  }

  if (payload.expires <= Math.floor((input.now ?? Date.now()) / 1000)) return false;
  if (payload.postcode !== input.postcode) return false;
  if (payload.serviceCode !== input.serviceCode) return false;
  if (payload.priceCents !== Math.round(input.price * 100)) return false;
  if (payload.shipmentKey !== input.shipmentKey) return false;

  const expected = Buffer.from(sign(encodedPayload), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
