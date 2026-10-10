import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { checkoutTotals } from "../lib/checkout-totals";
import { calculateCouponDiscount } from "../lib/coupon-utils";

const require = createRequire(import.meta.url);
const productId = "c1234567890123456789012345";
let signedIn = false;
let allowed = true;
let providerCalls = 0;
let limitIdentifier = "";
const db = {
  product: { findMany: async () => [{ id: productId, categoryId: "category", basePrice: 10, memberPrice: 7, weight: 1, length: 20, width: 20, height: 20, productVariants: [] }] },
  user: { findUnique: async () => ({ isMember: false, membershipExpiry: null }) },
  userCoupon: { count: async () => 0 },
  coupon: { findUnique: async () => ({ id: "coupon", code: "TEN", isActive: true, type: "GLOBAL", discountType: "PERCENTAGE", discountValue: 10, maxDiscount: null, minOrderAmount: null, memberEligibility: "ALL", products: [], categories: [] }) },
};
function stub(path: string, exports: unknown) { require.cache[require.resolve(path)] = { exports } as NodeModule; }
stub("../lib/db", { db });
stub("../auth", { auth: async () => signedIn ? { user: { id: "customer" } } : null });
stub("../lib/rate-limit", {
  getClientIp: () => "192.0.2.1",
  consumeRateLimit: async (_action: string, id: string) => { limitIdentifier = id; return { allowed, retryAfter: 60 }; },
  rateLimitResponse: () => Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } }),
});
stub("../lib/ship123", { getShip123Rates: async () => { providerCalls++; return [{ serviceCode: "STANDARD", price: 12, serviceName: "Standard" }]; }, getEligibleShip123Products: async () => [{ code: "STANDARD" }] });
stub("../lib/shipping-quote", { createShippingQuoteToken: () => "signed-quote", shippingDestinationKey: () => "destination" });
const shipping = require("../app/api/shipping/ship123/route") as typeof import("../app/api/shipping/ship123/route");
const coupons = require("../app/api/coupons/validate/route") as typeof import("../app/api/coupons/validate/route");
const request = (data: unknown) => new NextRequest("https://shop.example/api", { method: "POST", body: JSON.stringify(data) });

test("guest shipping remains available and shares an IP-based abuse limit", async () => {
  signedIn = false; allowed = true; providerCalls = 0;
  const body = { address: { name: "Test Buyer", line1: "1 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000", country: "AU" }, items: [{ productId, quantity: 1 }] };
  const response = await shipping.POST(request(body));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).rates[0].quoteToken, "signed-quote");
  assert.equal(limitIdentifier, "192.0.2.1");
  allowed = false;
  const limited = await shipping.POST(request(body));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.equal(providerCalls, 1);
  allowed = true;
});

test("shipping availability endpoint reports whether an allowed courier is configured", async () => {
  allowed = true;
  const response = await shipping.GET(new NextRequest("https://shop.example/api/shipping/ship123"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { available: true });
});

test("shipping and coupon POST classify malformed JSON as a client error", async () => {
  for (const handler of [shipping.POST, coupons.POST]) {
    assert.equal((await handler(new NextRequest("https://shop.example/api", { method: "POST", body: "{" }))).status, 400);
  }
});

test("ALL coupons change amount when membership changes prices, including non-variant carts", async () => {
  signedIn = true;
  const body = { code: "TEN", items: [{ productId, variantId: null, quantity: 3 }] };
  const regular = await coupons.POST(request(body));
  assert.equal(regular.status, 200);
  const initial = (await regular.json()).coupon;
  const member = await coupons.POST(request({ ...body, addMembership: true }));
  assert.equal(member.status, 200);
  const updated = (await member.json()).coupon;
  assert.equal(initial.subtotal, 30);
  assert.equal(initial.discount, 3);
  assert.equal(updated.subtotal, 21);
  assert.equal(updated.discount, 2.1);
  assert.equal(updated.discountedSubtotal, 18.9);
});

test("shared totals preserve the configured calculation for shipping, membership and cent rounding", () => {
  assert.deepEqual(checkoutTotals(29, 12, 0), { tax: 2.9, total: 43.9 });
  assert.deepEqual(checkoutTotals(18.9, 0, 30), { tax: 1.89, total: 50.79 });
  assert.deepEqual(checkoutTotals(0.05, 0, 0), { tax: 0.01, total: 0.06 });
  assert.equal(calculateCouponDiscount({ discountType: "FIXED", discountValue: 10, maxDiscount: 2 }, 30), 2);
  assert.equal(calculateCouponDiscount({ discountType: "PERCENTAGE", discountValue: 200, maxDiscount: null }, 30), 30);
});
