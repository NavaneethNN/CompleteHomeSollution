import { createHmac, timingSafeEqual } from "node:crypto";

/** A return link is a scoped, expiring capability, independent of host cookies.
 * It permits viewing/polling one order; it is never evidence of payment. */
export function createOrderReturnToken(orderId: string, now = Date.now()): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Order access signing secret is not configured");
  const expires = Math.floor(now / 1000) + 24 * 60 * 60;
  const signature = createHmac("sha256", secret).update(`order-return:${orderId}:${expires}`).digest("hex");
  return `${expires}.${signature}`;
}

export function verifyOrderReturnToken(orderId: string, token: string | null | undefined, now = Date.now()): boolean {
  if (!token || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, signature] = token.split(".");
  if (Number(expires) <= Math.floor(now / 1000)) return false;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`order-return:${orderId}:${expires}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function createGuestOrderToken(orderId: string, email: string): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Order access signing secret is not configured");
  return createHmac("sha256", secret).update(`guest-order:${orderId}:${email.trim().toLowerCase()}`).digest("hex");
}

export function verifyGuestOrderToken(orderId: string, email: string | null, token: string | null | undefined): boolean {
  if (!email || !token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(createGuestOrderToken(orderId, email), "hex");
  return timingSafeEqual(expected, Buffer.from(token, "hex"));
}
