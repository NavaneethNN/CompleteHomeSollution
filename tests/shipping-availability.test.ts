import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}
const actualCp = require("../lib/couriersplease");
const actualLimiter = require("../lib/rate-limit");
let allowed = true;
let availableState: { available: boolean; reason: string | null } = { available: true, reason: null };
let checkCalls = 0;
stub("../auth", { auth: async () => null });
const productId = "c1234567890123456789012345";
stub("../lib/db", { db: { product: { findMany: async () => [{
  id: productId, name: "Lamp", description: "Compact lamp", isLargeItem: false, weight: 1, length: 20, width: 15, height: 10, extraPackages: [], category: null, productVariants: [],
}] } } });
stub("../lib/shipping-quote", {
  createShippingQuoteToken: () => "test-quote-token",
  shippingDestinationKey: () => "test-destination",
});
stub("../lib/couriersplease", {
  ...actualCp,
  checkCouriersPleaseAvailability: () => {
    checkCalls++;
    return availableState;
  },
  getCouriersPleaseRates: async () => [{ serviceCode: "TSKG", serviceName: "Road Express", price: 12, deliveryTime: null }],
});
stub("../lib/rate-limit", {
  ...actualLimiter,
  consumeRateLimit: async () => ({ allowed, remaining: 0, retryAfter: 60 }),
});
const { GET, POST } = require("../app/api/shipping/couriersplease/route") as typeof import("../app/api/shipping/couriersplease/route");
const request = () => new NextRequest("https://shop.example/api/shipping/couriersplease");

test("availability distinguishes configured courier from unconfigured state and throttling", async () => {
  const available = await GET(request());
  assert.equal(available.status, 200);
  assert.deepEqual(await available.json(), { available: true, reason: null });

  availableState = { available: false, reason: "Missing credentials" };
  const unavailable = await GET(request());
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await unavailable.json(), { available: false, reason: "Missing credentials" });

  allowed = false;
  const callsBeforeLimit = checkCalls;
  const limited = await GET(request());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  assert.equal(checkCalls, callsBeforeLimit);
});

test("shipping quotes accept base products with null or omitted variants and reject invalid variant IDs", async () => {
  allowed = true;
  const address = { name: "Shipping Test", line1: "128 King William Street", suburb: "Adelaide", state: "SA", postcode: "5000", country: "AU" };
  for (const variantId of [null, undefined, "invalid"]) {
    const response = await POST(new NextRequest("https://shop.example/api/shipping/couriersplease", {
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
