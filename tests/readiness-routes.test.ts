import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
let session: { user: { id: string; role: string } } | null = null;
let storedRole = "CUSTOMER";
let qaWrites = 0;
let queuedShippingEmails = 0;
let shippingSms = 0;
let orderStatus = "REFUNDED";

const db = {
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  emailJob: { createMany: async () => { queuedShippingEmails++; return { count: 1 }; } },
  user: {
    findUnique: async () => session ? { role: storedRole } : null,
  },
  testResult: {
    findMany: async () => [],
    upsert: async ({ create }: { create: unknown }) => { qaWrites++; return create; },
  },
  order: {
    updateMany: async ({ where, data }: {
      where: { id: string; status: { in: string[] } };
      data: { status: string };
    }) => {
      if (where.id !== "order-1" || !where.status.in.includes(orderStatus)) return { count: 0 };
      orderStatus = data.status;
      return { count: 1 };
    },
    findUnique: async () => ({
      id: "order-1",
      status: orderStatus,
      guestEmail: "buyer@example.com",
      guestPhone: "0400000000",
      user: null,
      address: {},
    }),
  },
};

function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}

stub("../auth", { auth: async () => session });
stub("../lib/db", { db });
stub("../lib/brevo", {
  sendShippingUpdateEmail: async () => { queuedShippingEmails++; },
});
stub("../lib/twilio", {
  sendShippingUpdateSms: async () => { shippingSms++; },
});

const qa = require("../app/api/qa/results/route") as typeof import("../app/api/qa/results/route");
const shippit = require("../app/api/webhooks/shippit/route") as typeof import("../app/api/webhooks/shippit/route");

function qaRequest(body: unknown) {
  return new NextRequest("https://shop.example/api/qa/results", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("QA reads and writes require an administrator and validate writes", async () => {
  qaWrites = 0;
  session = null;
  storedRole = "CUSTOMER";
  assert.equal((await qa.GET(new NextRequest("https://shop.example/api/qa/results"))).status, 403);
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED" }))).status, 403);

  session = { user: { id: "customer", role: "CUSTOMER" } };
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED" }))).status, 403);

  session = { user: { id: "admin", role: "ADMIN" } };
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED" }))).status, 403);
  storedRole = "ADMIN";
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "NOT_A_STATUS" }))).status, 400);
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED", unexpected: true }))).status, 400);
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED" }))).status, 200);
  assert.equal(qaWrites, 1);
});

function signedShippingRequest(secret: string) {
  const body = JSON.stringify({
    retailer_invoice: "order-1",
    state: "dispatched",
    tracking_number: "TRACK-1",
    courier_name: "Courier",
  });
  return new NextRequest("https://shop.example/api/webhooks/shippit", {
    method: "POST",
    headers: { "x-shippit-hmac-sha256": createHmac("sha256", secret).update(body).digest("hex") },
    body,
  });
}

test("shipping events preserve terminal/unpaid states and queue one email", async t => {
  const previous = process.env.SHIPPIT_WEBHOOK_SECRET;
  process.env.SHIPPIT_WEBHOOK_SECRET = "route-test-secret";
  t.after(() => {
    if (previous === undefined) delete process.env.SHIPPIT_WEBHOOK_SECRET;
    else process.env.SHIPPIT_WEBHOOK_SECRET = previous;
  });

  for (const status of ["PENDING", "CANCELLED", "REFUNDED", "DELIVERED"]) {
    orderStatus = status;
    const response = await shippit.POST(signedShippingRequest("route-test-secret"));
    assert.equal(response.status, 200);
    assert.equal(orderStatus, status);
    assert.equal((await response.json()).ignored, true);
  }

  queuedShippingEmails = 0;
  shippingSms = 0;
  orderStatus = "PAID";
  assert.equal((await shippit.POST(signedShippingRequest("route-test-secret"))).status, 200);
  assert.equal(orderStatus, "SHIPPED");
  assert.equal(queuedShippingEmails, 1);
  assert.equal(shippingSms, 0);

  await shippit.POST(signedShippingRequest("route-test-secret"));
  assert.equal(queuedShippingEmails, 1);
  assert.equal(shippingSms, 0);
});
