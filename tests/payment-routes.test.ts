import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// Load actual route handlers with isolated authentication/database adapters.
// No database credentials, cards, email, or external services are used.
const require = createRequire(import.meta.url);
let session: { user: { id: string; role: string; email?: string } } | null;
let order: Record<string, unknown>;
let stock: number;
let failCommit = false;
let failMembership = false;
let createdOrders = 0;
let activeMember = false;
let queuedJobs: string[] = [];
let queuedPayloads: unknown[] = [];
let failQueue = false;
function matches(where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => order[key] === value);
}
const db = {
  emailJob: { createMany: async ({ data }: { data: { key: string; payload?: unknown }[] }) => { if (failQueue) throw new Error("Outbox unavailable"); queuedJobs.push(...data.map(job => job.key)); queuedPayloads.push(...data.map(job => job.payload)); return { count: data.length }; } },
  user: { findUniqueOrThrow: async () => ({ isMember: activeMember, membershipExpiry: null }) },
  membershipPlan: { findFirst: async () => ({ id: "c1234567890123456789012346", price: 30, durationDays: 30, name: "Premium" }) },
  order: {
    findFirst: async () => createdOrders ? structuredClone(order) : null,
    create: async ({ data }: { data: Record<string, unknown> }) => { createdOrders++; order = { ...order, ...data, userId: "owner", status: "PENDING", paywayTransactionId: null }; return structuredClone(order); },
    findUnique: async () => structuredClone(order),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (!matches(where)) return { count: 0 };
      Object.assign(order, data); return { count: 1 };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      if (failCommit) throw new Error("Simulated database failure");
      Object.assign(order, data); return order;
    },
  },
  product: {
    update: async () => { stock++; },
    updateMany: async ({ where }: { where: { stock?: { gte: number } } }) => {
      if (where.stock && stock < where.stock.gte) return { count: 0 };
      stock--; return { count: 1 };
    },
    findUnique: async () => ({ name: "Product" }),
  },
  membershipPayment: {
    findUnique: async () => null,
    findFirst: async () => { if (failMembership) throw new Error("Membership storage unavailable"); return null; },
  },
  $queryRaw: async () => [],
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    const previous = structuredClone(order), previousStock = stock, previousJobs = [...queuedJobs], previousPayloads = [...queuedPayloads];
    try { return await fn(db); } catch (error) { order = previous; stock = previousStock; queuedJobs = previousJobs; queuedPayloads = previousPayloads; throw error; }
  },
};
function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}
stub("../auth", { auth: async () => session });
stub("../lib/db", { db });
stub("../lib/brevo", { sendOrderCancellationEmail: async () => {}, sendRefundRequestEmail: async () => {}, sendOrderConfirmationEmail: async () => {} });
stub("../lib/twilio", { sendOrderConfirmationSms: async () => {}, sendOrderWhatsApp: async () => {} });
// Route tests have no Next.js request lifecycle for deferred notifications.
stub("next/server", { ...require("next/server"), after: () => {} });
const adminRefund = require("../app/api/admin/orders/[orderId]/refund/route").POST;
const cancel = require("../app/api/orders/[id]/cancel/route").POST;
const poll = require("../app/api/orders/[id]/poll-payment/route").GET;
const membershipCheckout = require("../app/api/membership/checkout/route").POST;
const id = "c1234567890123456789012345";
const context = { params: Promise.resolve({ orderId: id, id }) };
function request(body: unknown, path = "refund") {
  return new NextRequest(`https://shop.example/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function reset() {
  session = { user: { id: "owner", role: "ADMIN", email: "test@example.com" } };
  order = { id, userId: "owner", status: "PAID", total: 30, refundAmount: null, refundProcessing: false,
    refundAttemptAmount: null, refundAttemptRestoreStock: null, refundRequested: false,
    membershipAmount: 0, paywayTransactionId: "ONLINEPAY:checkout-123", user: null, guestEmail: null,
    items: [{ productId: "product", quantity: 1, productVariantId: null, product: { name: "Product" } }] };
  stock = 0; failCommit = false; failMembership = false; createdOrders = 0; activeMember = false; queuedJobs = []; queuedPayloads = []; failQueue = false;
}
function provider(t: TestContext) {
  for (const key of ["ONLINEPAY_USER_UID", "ONLINEPAY_API_KEY", "ONLINEPAY_PPC_ID"]) {
    const previous = process.env[key]; process.env[key] = "test";
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const keys: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    if (!init.method) return Response.json({ id: "checkout-123", merchant_reference: order.id, amount: 3000, currency_code: "AUD", transaction_id: `payment-${order.id}`, events: [{ type: "TRANSACTION_SUCCESS" }] });
    keys.push((init.headers as Record<string, string>)["x-vfi-api-idempotencykey"]);
    return Response.json({ id: "refund-123", amount: JSON.parse(init.body as string).amount, payment_provider_contract: "test", status: "REFUNDED" });
  });
  return keys;
}

test("refund and membership routes reject unauthenticated callers and refund ownership violations", async () => {
  reset(); session = null;
  assert.equal((await adminRefund(request({ amount: 30 }), context)).status, 403);
  assert.equal((await cancel(request({}), context)).status, 401);
  assert.equal((await membershipCheckout(request({}))).status, 401);
  session = { user: { id: "other", role: "CUSTOMER" } };
  assert.equal((await adminRefund(request({ amount: 30 }), context)).status, 403);
  assert.equal((await cancel(request({}), context)).status, 403);
  assert.equal((await poll(new NextRequest("https://shop.example/poll"), context)).status, 403);
});

test("refund route rejects fractional cents, excess amounts, pending payments, and competing attempts", async () => {
  reset();
  assert.equal((await adminRefund(request({ amount: 1.001 }), context)).status, 400);
  assert.equal((await adminRefund(request({ amount: 31 }), context)).status, 400);
  order.status = "PENDING";
  assert.equal((await adminRefund(request({ amount: 30 }), context)).status, 409);
  order.status = "PAID"; order.refundProcessing = true; order.refundAttemptAmount = 10; order.refundAttemptRestoreStock = false;
  assert.equal((await adminRefund(request({ amount: 30 }), context)).status, 409);
  assert.equal(stock, 0);
});

test("partial then remaining refund records cumulative cents and restores stock once", async t => {
  reset(); provider(t);
  assert.equal((await adminRefund(request({ amount: 10 }), context)).status, 200);
  assert.equal(order.status, "PAID"); assert.equal(order.refundAmount, 10); assert.equal(stock, 0);
  assert.equal((await adminRefund(request({ amount: 21 }), context)).status, 400);
  assert.equal((await adminRefund(request({ amount: 20, restoreStock: true }), context)).status, 200);
  assert.equal(order.status, "REFUNDED"); assert.equal(order.refundAmount, 30); assert.equal(stock, 1);
  assert.equal((await adminRefund(request({ amount: 20, restoreStock: true }), context)).status, 400);
  assert.equal(stock, 1);
  assert.deepEqual(queuedJobs, [
    `order:${id}:refund:1000:customer`, `order:${id}:refund:1000:admin`,
    `order:${id}:refund:3000:customer`, `order:${id}:refund:3000:admin`,
  ]);
  assert.deepEqual(queuedPayloads[0], { refundAmount: 10, autoRefunded: false, isPartial: true, audience: "customer" });
  assert.deepEqual(queuedPayloads[2], { refundAmount: 20, autoRefunded: false, isPartial: false, audience: "customer" });
});

test("provider success followed by DB failure can reconcile with the original idempotency key", async t => {
  reset(); const keys = provider(t); t.mock.method(console, "error", () => {});
  failCommit = true;
  assert.equal((await adminRefund(request({ amount: 30, restoreStock: true }), context)).status, 500);
  assert.equal(order.status, "PAID"); assert.equal(order.refundProcessing, true); assert.equal(order.refundAmount, null); assert.equal(stock, 0);
  failCommit = false;
  assert.equal((await adminRefund(request({ amount: 30, restoreStock: true }), context)).status, 200);
  assert.equal(keys[0], keys[1]); assert.equal(stock, 1); assert.equal(order.refundAmount, 30);
});

test("concurrent identical refunds restore inventory once", async t => {
  reset(); const keys = provider(t);
  const responses = await Promise.all([adminRefund(request({ amount: 30, restoreStock: true }), context), adminRefund(request({ amount: 30, restoreStock: true }), context)]);
  assert.ok(responses.every(r => [200, 409].includes(r.status)));
  assert.equal(stock, 1); assert.equal(order.refundAmount, 30);
  assert.equal(new Set(keys).size, 1);
});

test("customer pre-shipment OnlinePay cancellation returns funds and stock", async t => {
  reset(); provider(t); session!.user.role = "CUSTOMER";
  const response = await cancel(request({ reason: "Changed plans" }), context);
  assert.equal(response.status, 200); assert.equal((await response.json()).autoRefunded, true);
  assert.equal(order.status, "REFUNDED"); assert.equal(stock, 1);
});

test("membership fee cancellation is referred for administrator review", async t => {
  reset(); provider(t); session!.user.role = "CUSTOMER"; order.membershipAmount = 30;
  const response = await cancel(request({}), context);
  assert.equal(response.status, 200); assert.equal((await response.json()).autoRefunded, false);
  assert.equal(order.status, "PAID"); assert.equal(order.refundRequested, true); assert.equal(stock, 0);
});

test("membership activation failure rolls back payment settlement and stock for retry", async t => {
  reset(); provider(t); t.mock.method(console, "error", () => {});
  order.status = "PENDING"; order.membershipAmount = 30; failMembership = true; stock = 1;
  const response = await poll(new NextRequest("https://shop.example/poll"), context);
  assert.equal(response.status, 500); assert.equal(order.status, "PENDING"); assert.equal(stock, 1);
});


test("standalone membership creates a hosted order with a snapshot and reuses the outstanding checkout", async t => {
  reset();
  membershipEnvironment(t);
  let hostedRequests = 0;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    hostedRequests++;
    const body = JSON.parse(init.body as string);
    assert.equal(body.amount, 3000); assert.equal(body.merchant_reference, id);
    assert.equal(body.customer_details.billing.postal_code, "2000");
    return Response.json({ id: "checkout-123", url: "https://provider.example/pay" });
  });
  const body = { address: { name: "Test Buyer", phone: "0400000000", line1: "1 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000" } };
  const first = await membershipCheckout(request(body));
  assert.equal(first.status, 200);
  assert.equal((await first.json()).url, "https://provider.example/pay");
  assert.equal(order.membershipAmount, 30); assert.equal(order.membershipDurationDays, 30);
  assert.equal(order.status, "PENDING"); assert.equal(order.paywayTransactionId, "ONLINEPAY:checkout-123");
  const second = await membershipCheckout(request(body));
  assert.equal(second.status, 200);
  assert.match((await second.json()).url, /order-confirmation/);
  assert.equal(createdOrders, 1); assert.equal(hostedRequests, 1);
  activeMember = true;
  assert.equal((await membershipCheckout(request(body))).status, 409);
});

function membershipEnvironment(t: TestContext) {
  const values = { ONLINEPAY_USER_UID: "test", ONLINEPAY_API_KEY: "test", ONLINEPAY_ENTITY_ID: "test", ONLINEPAY_PPC_ID: "test", ONLINEPAY_3DS_ID: "test", PAYMENT_GATEWAY: "onlinepay", ONLINEPAY_RETURN_BASE_URL: "https://shop.example", AUTH_SECRET: "test-secret-for-route-testing-only" };
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

const membershipBody = { address: { name: "Test Buyer", phone: "0400000000", line1: "1 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000" } };

test("missing membership migration returns unavailable without contacting the gateway", async t => {
  reset(); membershipEnvironment(t);
  t.mock.method(console, "error", () => {});
  t.mock.method(db.order, "findFirst", async () => {
    throw new Prisma.PrismaClientKnownRequestError("Missing column", { code: "P2022", clientVersion: "7.10.0" });
  });
  let providerCalls = 0;
  t.mock.method(globalThis, "fetch", async () => { providerCalls++; return Response.json({}); });
  const response = await membershipCheckout(request(membershipBody));
  assert.equal(response.status, 503);
  assert.equal(createdOrders, 0);
  assert.equal(providerCalls, 0);
});

test("missing return-link signing secret does not leave a pending membership order", async t => {
  reset(); membershipEnvironment(t);
  const previous = process.env.NEXTAUTH_SECRET;
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  t.after(() => { if (previous !== undefined) process.env.NEXTAUTH_SECRET = previous; });
  assert.equal((await membershipCheckout(request(membershipBody))).status, 503);
  assert.equal(createdOrders, 0);
});

test("membership rejects oversized addresses before creating an order", async t => {
  reset(); membershipEnvironment(t);
  const response = await membershipCheckout(request({ address: { ...membershipBody.address, line1: "A".repeat(121) } }));
  assert.equal(response.status, 400);
  assert.equal(createdOrders, 0);
});

test("provider billing rejection cancels the order and returns a correctable error", async t => {
  reset(); membershipEnvironment(t);
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => Response.json({ details: { "customer_details.billing.first_name": ["invalid"] } }, { status: 400 }));
  const response = await membershipCheckout(request(membershipBody));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /billing details/);
  assert.equal(order.status, "CANCELLED");
});

test("uncertain provider failure preserves the order and prevents a second checkout", async t => {
  reset(); membershipEnvironment(t);
  t.mock.method(console, "error", () => {});
  let attempts = 0;
  t.mock.method(globalThis, "fetch", async () => { attempts++; throw new Error("Connection interrupted"); });
  assert.equal((await membershipCheckout(request(membershipBody))).status, 502);
  assert.equal(order.status, "PENDING");
  assert.equal((await membershipCheckout(request(membershipBody))).status, 200);
  assert.equal(attempts, 1);
});

test("verified membership payment settles and activates exactly once across repeated polls", async t => {
  reset(); provider(t);
  order.status = "PENDING";
  order.items = [];
  order.membershipAmount = 30;
  order.membershipPlanId = "plan";
  order.membershipDurationDays = 30;
  const member = { isMember: false, memberSince: null, membershipExpiry: null };
  const payments: Record<string, unknown>[] = [];
  // Use the real activation function and settlement route with in-memory storage.
  Object.assign(db.user, {
    findUnique: async () => ({ ...member }),
    update: async ({ data }: { data: object }) => Object.assign(member, data),
  });
  Object.assign(db.membershipPlan, {
    findUnique: async () => ({ id: "plan", durationDays: 999 }),
  });
  Object.assign(db.membershipPayment, {
    create: async ({ data }: { data: Record<string, unknown> }) => { payments.push(data); return data; },
  });
  t.mock.method(db.membershipPayment, "findFirst", async () => payments[0] ?? null);
  const before = Date.now();
  const first = await poll(new NextRequest("https://shop.example/poll"), context);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).status, "paid");
  assert.equal(order.status, "PAID");
  assert.equal(member.isMember, true);
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amount, 30);
  assert.equal(payments[0].paywaySessionId, `order:${id}:membership`);
  const expiry = (payments[0].expiresAt as Date).getTime();
  assert.ok(expiry >= before + 30 * 86400000 && expiry <= Date.now() + 30 * 86400000);
  assert.equal((await poll(new NextRequest("https://shop.example/poll"), context)).status, 200);
  assert.equal(payments.length, 1);
  assert.equal(stock, 0);
});

test("approved payment with exhausted stock creates one durable refund action", async t => {
  reset(); provider(t); t.mock.method(console, "error", () => {});
  order.status = "PENDING";
  stock = 0;
  const response = await poll(new NextRequest("https://shop.example/poll"), context);
  assert.equal(response.status, 409);
  assert.equal(order.status, "CANCELLED");
  assert.equal(order.refundRequested, true);
  assert.equal(stock, 0);
  assert.deepEqual(queuedJobs, [`order:${id}:refund-action`]);
  assert.equal((await poll(new NextRequest("https://shop.example/poll"), context)).status, 200);
  assert.deepEqual(queuedJobs, [`order:${id}:refund-action`]);
});

test("two approved payments for the last unit fulfill one order and flag the other for refund", async t => {
  reset(); provider(t); t.mock.method(console, "error", () => {});
  order.status = "PENDING";
  stock = 1;
  const first = await poll(new NextRequest("https://shop.example/poll"), context);
  assert.equal(first.status, 200);
  assert.equal(order.status, "PAID");
  assert.equal(stock, 0);

  const secondId = "c1234567890123456789012347";
  order = { ...order, id: secondId, status: "PENDING", refundRequested: false, paywayTransactionId: "ONLINEPAY:checkout-123" };
  const secondContext = { params: Promise.resolve({ id: secondId }) };
  const second = await poll(new NextRequest("https://shop.example/poll"), secondContext);
  assert.equal(second.status, 409);
  assert.equal(order.status, "CANCELLED");
  assert.equal(order.refundRequested, true);
  assert.equal(stock, 0);
  assert.deepEqual(queuedJobs.filter(key => key.endsWith(":refund-action")), [`order:${secondId}:refund-action`]);
});

test("mismatched provider payment details never settle a membership order", async t => {
  reset(); provider(t);
  t.mock.method(console, "error", () => {});
  order.status = "PENDING";
  order.membershipAmount = 30;
  for (const mismatch of [
    { id: "other-checkout" }, { merchant_reference: "another-order" },
    { amount: 1 }, { currency_code: "USD" },
  ]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({
      id: "checkout-123", merchant_reference: id, amount: 3000,
      currency_code: "AUD", events: [{ type: "TRANSACTION_SUCCESS" }], ...mismatch,
    }));
    assert.equal((await poll(new NextRequest("https://shop.example/poll"), context)).status, 502);
    assert.equal(order.status, "PENDING");
    assert.equal(stock, 0);
  }
});


test("refund commit requires a durable receipt and can recover without double stock", async t => {
  reset(); const keys = provider(t); t.mock.method(console, "error", () => {});
  failQueue = true;
  assert.equal((await adminRefund(request({ amount: 30, restoreStock: true }), context)).status, 500);
  assert.equal(stock, 0);
  assert.equal(order.refundAmount, null);
  assert.equal(order.refundProcessing, true);
  assert.deepEqual(queuedJobs, []);
  failQueue = false;
  assert.equal((await adminRefund(request({ amount: 30, restoreStock: true }), context)).status, 200);
  assert.equal(keys[0], keys[1]);
  assert.equal(stock, 1);
  assert.equal(queuedJobs.length, 2);
});
