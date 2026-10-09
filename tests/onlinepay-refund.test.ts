import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { refundOnlinePayOrder, OnlinePayRefundError } from "../lib/onlinepay";

const input = { checkoutId: "checkout-123", orderId: "order-123", orderTotal: 30, amount: 10, refundedBefore: 0 };
const checkout = { id: "checkout-123", merchant_reference: "order-123", amount: 3000, currency_code: "AUD", transaction_id: "payment-123", events: [{ type: "TRANSACTION_SUCCESS" }] };

function setup(t: TestContext) {
  for (const key of ["ONLINEPAY_USER_UID", "ONLINEPAY_API_KEY", "ONLINEPAY_PPC_ID"]) {
    const previous = process.env[key]; process.env[key] = "test";
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

test("refund resolves payment ID and retries with the same UUID and integer cents", async t => {
  setup(t);
  const keys: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (!init.method) return Response.json(checkout);
    assert.match(url, /\/transactions\/payment-123\/refund$/);
    assert.equal(JSON.parse(init.body as string).amount, 1000);
    const key = (init.headers as Record<string, string>)["x-vfi-api-idempotencykey"];
    assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    keys.push(key);
    return Response.json({ id: "refund-123", amount: 1000, status: "REFUNDED", payment_provider_contract: "test" }, { status: 201 });
  });
  assert.equal((await refundOnlinePayOrder(input)).status, "approved");
  await refundOnlinePayOrder(input);
  await refundOnlinePayOrder({ ...input, refundedBefore: 10 });
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[1], keys[2]);
});

test("refund rejects mismatched reference, amount, currency and unproved payment before POST", async t => {
  setup(t);
  for (const change of [{ merchant_reference: "other-order" }, { amount: 1 }, { currency_code: "USD" }, { events: [{ type: "THREEDS_AUTHENTICATION_SUCCESS" }] }, { transaction_id: "../other" }]) {
    t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
      assert.equal(init.method, undefined);
      return Response.json({ ...checkout, ...change });
    });
    await assert.rejects(refundOnlinePayOrder(input), OnlinePayRefundError);
  }
});

test("refund accepts event transaction ID when checkout has no top-level ID", async t => {
  setup(t);
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (!init.method) return Response.json({ ...checkout, transaction_id: undefined, events: [{ type: "TRANSACTION_SUCCESS", transaction_id: "event-payment-123" }] });
    assert.match(url, /event-payment-123\/refund$/);
    return Response.json({ id: "refund-123", amount: 1000, status: "REFUNDED", payment_provider_contract: "test" });
  });
  assert.equal((await refundOnlinePayOrder(input)).status, "approved");
});

test("pending and declined refund responses never establish a completed refund", async t => {
  setup(t);
  for (const status of ["PENDING", "UNKNOWN", "AUTHORIZED", "DECLINED", "FAILED"]) {
    t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => Response.json(url.includes("/transaction/") ? { id: "refund-123", parent_id: "payment-123", transaction_type: "REFUND", currency_code: "AUD", amount: "10.00", transaction_status: status } : !init.method ? checkout : { id: "refund-123", amount: 1000, status, payment_provider_contract: "test" }));
    assert.notEqual((await refundOnlinePayOrder(input)).status, "approved");
  }
});

test("unverified and uncertain refund outcomes retain the refund claim", async t => {
  setup(t);
  for (const [status, payload] of [[500, {}], [201, { id: "refund-123", amount: 999, status: "REFUNDED", payment_provider_contract: "test" }], [201, { id: "refund-123", amount: 1000, status: "REFUNDED", payment_provider_contract: "other" }]] as const) {
    t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => !init.method ? Response.json(checkout) : Response.json(payload, { status }));
    await assert.rejects(refundOnlinePayOrder(input), (error: unknown) => error instanceof OnlinePayRefundError && !error.safeToRetry);
  }
});

test("invalid fractional-cent refunds never reach the gateway", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected network call"); });
  for (const amount of [0, -1, NaN, Infinity, 1.001]) await assert.rejects(refundOnlinePayOrder({ ...input, amount }), OnlinePayRefundError);
});


test("a pending refund is reconciled from its own settled transaction without trusting another refund", async t => {
  setup(t);
  let parent = "payment-123";
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.includes("/transaction/")) return Response.json({ id: "refund-123", parent_id: parent, transaction_type: "REFUND", currency_code: "AUD", amount: "10.00", transaction_status: "SETTLED" });
    return Response.json(!init.method ? checkout : { id: "refund-123", amount: 1000, status: "PENDING", payment_provider_contract: "test" });
  });
  assert.equal((await refundOnlinePayOrder(input)).status, "approved");
  parent = "someone-elses-payment";
  await assert.rejects(refundOnlinePayOrder(input), (error: unknown) => error instanceof OnlinePayRefundError && !error.safeToRetry);
});
