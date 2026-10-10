import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}
const actualShip123 = require("../lib/ship123");
const actualLimiter = require("../lib/rate-limit");
let allowed = true;
let mode: "available" | "empty" | "failure" = "available";
let providerCalls = 0;
stub("../auth", { auth: async () => null });
const productId = "c1234567890123456789012345";
stub("../lib/db", { db: { product: { findMany: async () => [{
  id: productId, weight: 1, length: 20, width: 15, height: 10, productVariants: [],
}] } } });
stub("../lib/shipping-quote", {
  createShippingQuoteToken: () => "test-quote-token",
  shippingDestinationKey: () => "test-destination",
});
stub("../lib/ship123", {
  ...actualShip123,
  getShip123Rates: async () => [{ serviceCode: "AU_POST_STANDARD", serviceName: "Standard", price: 12, deliveryTime: null }],
  getEligibleShip123Products: async () => {
    providerCalls++;
    if (mode === "failure") throw new actualShip123.Ship123Error("Ship123 is currently unreachable");
    return mode === "available" ? [{ code: "AU_POST_STANDARD", carrier: "AUSTRALIA POST" }] : [];
  },
});
stub("../lib/rate-limit", {
  ...actualLimiter,
  consumeRateLimit: async () => ({ allowed, remaining: 0, retryAfter: 60 }),
});
const { GET, POST } = require("../app/api/shipping/ship123/route") as typeof import("../app/api/shipping/ship123/route");
const request = () => new NextRequest("https://shop.example/api/shipping/ship123");

test("availability distinguishes missing couriers from provider failures and throttling", async t => {
  t.mock.method(console, "error", () => {});
  const available = await GET(request());
  assert.equal(available.status, 200);
  assert.deepEqual(await available.json(), { available: true, reason: null });

  mode = "empty";
  const empty = await GET(request());
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { available: false, reason: "NO_SUPPORTED_COURIER" });

  mode = "failure";
  const failure = await GET(request());
  assert.equal(failure.status, 503);
  assert.equal(failure.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await failure.json(), { available: false, reason: "PROVIDER_UNAVAILABLE" });

  allowed = false;
  const callsBeforeLimit = providerCalls;
  const limited = await GET(request());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  assert.equal(providerCalls, callsBeforeLimit);
});

test("shipping quotes accept base products with null or omitted variants and reject invalid variant IDs", async () => {
  allowed = true;
  const address = { name: "Shipping Test", line1: "128 King William Street", suburb: "Adelaide", state: "SA", postcode: "5000", country: "AU" };
  for (const variantId of [null, undefined, "invalid"]) {
    const response = await POST(new NextRequest("https://shop.example/api/shipping/ship123", {
      method: "POST",
      body: JSON.stringify({ address, items: [{ productId, variantId, quantity: 1 }] }),
    }));
    const data = await response.json();
    if (variantId === "invalid") {
      assert.equal(response.status, 400);
      assert.match(data.error, /items\.0\.variantId/);
    } else {
      assert.equal(response.status, 200);
      assert.equal(data.rates[0].price, 12);
      assert.equal(data.rates[0].quoteToken, "test-quote-token");
    }
  }
});
