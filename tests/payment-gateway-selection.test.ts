import { test } from "node:test";
import assert from "node:assert/strict";
import { configuredPaymentGateway } from "../lib/payment-gateway-selection";

test("gateway must be explicitly selected on the server", () => {
  assert.equal(configuredPaymentGateway({ NEXT_PUBLIC_PAYMENT_GATEWAY: "payway" }), null);
  assert.equal(configuredPaymentGateway({ PAYMENT_GATEWAY: "onlinepay", NEXT_PUBLIC_PAYMENT_GATEWAY: "payway" }), null);
  assert.equal(configuredPaymentGateway({ PAYMENT_GATEWAY: "onlinepay", NEXT_PUBLIC_PAYMENT_GATEWAY: "onlinepay" }), "onlinepay");
  assert.equal(configuredPaymentGateway({ PAYMENT_GATEWAY: "payway" }), "payway");
});
