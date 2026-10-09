import { test } from "node:test";
import assert from "node:assert/strict";
import { onlinePayPaymentSucceeded, onlinePayPaymentFailed, createOnlinePayCheckout, getOnlinePayCheckout, onlinePayBillingAddress, OnlinePayCheckoutError } from "../lib/onlinepay";

test("billing addresses preserve all characters within provider line limits", () => {
  for (const length of [1, 40, 41, 72, 80, 81, 120]) {
    const input = "123 Test Road ".repeat(10).slice(0, length).trim();
    const lines = Object.values(onlinePayBillingAddress(input));
    assert.ok(lines.every(line => line.length > 0 && line.length <= 40));
    assert.equal(lines.join(""), input);
  }
  assert.throws(() => onlinePayBillingAddress("A".repeat(121)), /120 characters/);
});

test("authentication and token events never establish a paid order", () => {
  for (const type of ["THREEDS_AUTHENTICATION_SUCCESS", "CARD_TOKEN_SUCCESS", "SUCCESS", "AUTHORIZED"]) {
    assert.equal(onlinePayPaymentSucceeded({ id: "checkout", events: [{ type, status: "success" }] }), false);
  }
});
test("transaction success establishes payment even after a failed card attempt", () => {
  const checkout = { id: "checkout", events: [{ type: "TRANSACTION_FAILED" }, { type: "TRANSACTION_SUCCESS" }] };
  assert.equal(onlinePayPaymentSucceeded(checkout), true);
  assert.equal(onlinePayPaymentFailed(checkout), false);
});
test("a retryable card decline does not close the hosted checkout", () => {
  assert.equal(onlinePayPaymentFailed({ id: "checkout", events: [{ type: "TRANSACTION_FAILED" }] }), false);
  assert.equal(onlinePayPaymentFailed({ id: "checkout", status: "EXPIRED" }), true);
});
test("missing payment evidence is pending", () => {
  assert.equal(onlinePayPaymentSucceeded({ id: "checkout" }), false);
  assert.equal(onlinePayPaymentFailed({ id: "checkout" }), false);
});
test("reject invalid checkout IDs before making a provider request", async () => {
  await assert.rejects(getOnlinePayCheckout("../transactions"), /Invalid OnlinePay checkout ID/);
});
test("hosted checkout sends integer AUD amount and handles upstream failure", async (t) => {
  for (const key of ["ONLINEPAY_USER_UID", "ONLINEPAY_API_KEY", "ONLINEPAY_ENTITY_ID", "ONLINEPAY_PPC_ID", "ONLINEPAY_3DS_ID"]) {
    const previous = process.env[key];
    process.env[key] = "test";
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const input = { amountCents: 1250, merchantReference: "order-123", returnUrl: "https://shop.example/return", shopUrl: "https://shop.example", customer: { email: "test@example.com", firstName: "Test", lastName: "Buyer", address1: "1 Test Street ".padEnd(120, "A"), city: "Sydney", state: "NSW", postcode: "2000" }, lineItems: [{ name: "Test", quantity: 1, unitPriceCents: 1250 }] };
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    assert.equal(body.amount, 1250);
    assert.equal(body.currency_code, "AUD");
    assert.equal(body.line_items[0].total_amount, 1250);
    assert.ok(init.signal);
    const billing = body.customer_details.billing;
    assert.equal(billing.address_1.length, 40);
    assert.equal(billing.address_2.length, 40);
    assert.equal(billing.address_3.length, 40);
    assert.equal(billing.address_1 + billing.address_2 + billing.address_3, input.customer.address1);
    return Response.json({ id: "checkout-123", url: "https://provider.example/pay" });
  });
  assert.equal((await createOnlinePayCheckout(input)).id, "checkout-123");
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Contract unavailable" }, { status: 400 }));
  await assert.rejects(createOnlinePayCheckout(input), /Contract unavailable/);
  t.mock.method(globalThis, "fetch", async () => Response.json({ details: { "customer_details.billing.address_1": ["invalid"] } }, { status: 400 }));
  await assert.rejects(createOnlinePayCheckout(input), (error: unknown) => {
    assert.ok(error instanceof OnlinePayCheckoutError);
    assert.equal(error.httpStatus, 400);
    assert.equal(error.definitelyRejected, true);
    assert.deepEqual(error.invalidFields, ["customer_details.billing.address_1"]);
    return true;
  });
});
