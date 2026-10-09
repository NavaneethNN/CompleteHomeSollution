import { test } from "node:test";
import assert from "node:assert/strict";
import { createShippingQuoteToken, verifyShippingQuoteToken } from "../lib/shipping-quote";

test("shipping quote token verifies the exact quoted rate", (t) => {
  const old = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret-for-shipping-quotes";
  t.after(() => { if (old === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = old; });

  const now = Date.UTC(2026, 8, 19, 12, 0, 0);
  const token = createShippingQuoteToken({
    postcode: "3000",
    shipmentKey: "shipment-a",
    serviceCode: "AUS_PARCEL_REGULAR",
    price: 14.95,
    now,
  });

  assert.equal(verifyShippingQuoteToken({
    token,
    postcode: "3000",
    shipmentKey: "shipment-a",
    serviceCode: "AUS_PARCEL_REGULAR",
    price: 14.95,
    now,
  }), true);
});

test("shipping quote token rejects tampering and expiry", (t) => {
  const old = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret-for-shipping-quotes";
  t.after(() => { if (old === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = old; });

  const now = Date.UTC(2026, 8, 19, 12, 0, 0);
  const token = createShippingQuoteToken({
    postcode: "3000",
    shipmentKey: "shipment-a",
    serviceCode: "AUS_PARCEL_REGULAR",
    price: 14.95,
    now,
  });

  assert.equal(verifyShippingQuoteToken({ token, postcode: "2000", shipmentKey: "shipment-a", serviceCode: "AUS_PARCEL_REGULAR", price: 14.95, now }), false);
  assert.equal(verifyShippingQuoteToken({ token, postcode: "3000", shipmentKey: "shipment-a", serviceCode: "AUS_PARCEL_EXPRESS", price: 14.95, now }), false);
  assert.equal(verifyShippingQuoteToken({ token, postcode: "3000", shipmentKey: "shipment-a", serviceCode: "AUS_PARCEL_REGULAR", price: 1, now }), false);
  assert.equal(verifyShippingQuoteToken({ token, postcode: "3000", shipmentKey: "shipment-b", serviceCode: "AUS_PARCEL_REGULAR", price: 14.95, now }), false);
  assert.equal(verifyShippingQuoteToken({ token, postcode: "3000", shipmentKey: "shipment-a", serviceCode: "AUS_PARCEL_REGULAR", price: 14.95, now: now + 10 * 60 * 1000 }), false);
  assert.equal(verifyShippingQuoteToken({ token: `${token.slice(0, -1)}0`, postcode: "3000", shipmentKey: "shipment-a", serviceCode: "AUS_PARCEL_REGULAR", price: 14.95, now }), false);
});
