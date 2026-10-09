import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCartPricing, splitLineForGateway } from "../lib/cart-pricing";

test("fixed coupon remainder is allocated in cents and gateway lines equal stored subtotal", () => {
  const result = calculateCartPricing([
    { key: "product", unitPriceCents: 1000, quantity: 3, eligible: true },
  ], { type: "FIXED", value: 1 });
  assert.equal(result.grossSubtotalCents, 3000);
  assert.equal(result.discountCents, 100);
  assert.equal(result.subtotalCents, 2900);
  assert.equal(result.lines[0].netCents, 2900);
  const gateway = splitLineForGateway(result.lines[0]);
  assert.deepEqual(gateway, [
    { quantity: 2, unitPriceCents: 967 },
    { quantity: 1, unitPriceCents: 966 },
  ]);
  assert.equal(gateway.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0), result.subtotalCents);
});

test("percentage and capped discounts allocate only across eligible lines", () => {
  const result = calculateCartPricing([
    { key: "a", unitPriceCents: 999, quantity: 2, eligible: true },
    { key: "b", unitPriceCents: 500, quantity: 1, eligible: false },
  ], { type: "PERCENTAGE", value: 33.333, maxDiscount: 5 });
  assert.equal(result.discountCents, 500);
  assert.equal(result.lines[1].discountCents, 0);
  assert.equal(result.subtotalCents, 1998);
});
