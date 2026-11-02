import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
let freshAdmin = true;
let failQueue = false;
let status = "PAID";
let refundRequested = false;
let refundProcessing = false;
let queued = 0;
const db = {
  order: {
    findUnique: async () => ({ id: "order-1", status, refundRequested, refundProcessing }),
    findUniqueOrThrow: async () => ({ id: "order-1", status, refundRequested, refundProcessing }),
    updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
      if (where.status !== status) return { count: 0 };
      status = data.status; return { count: 1 };
    },
  },
  emailJob: { createMany: async () => { if (failQueue) throw new Error("Outbox unavailable"); queued++; } },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    const before = status;
    try { return await fn(db); } catch (error) { status = before; throw error; }
  },
};
require.cache[require.resolve("../lib/db")] = { exports: { db } } as NodeModule;
require.cache[require.resolve("../lib/admin-auth")] = { exports: { hasFreshAdminSession: async () => freshAdmin } } as NodeModule;
const { PUT } = require("../app/api/orders/[id]/status/route") as typeof import("../app/api/orders/[id]/status/route");
const context = { params: Promise.resolve({ id: "order-1" }) };
const request = (body: string) => new NextRequest("https://shop.example/api/orders/order-1/status", { method: "PUT", body });

test("status updates fail closed for demoted admins and malformed requests", async () => {
  freshAdmin = false;
  assert.equal((await PUT(request('{"status":"PROCESSING"}'), context)).status, 401);
  freshAdmin = true;
  assert.equal((await PUT(request('{'), context)).status, 400);
  assert.equal(status, "PAID");
});

test("status transition and notification commit together without duplicate same-status emails", async t => {
  t.mock.method(console, "error", () => {});
  failQueue = true;
  assert.equal((await PUT(request('{"status":"PROCESSING"}'), context)).status, 500);
  assert.equal(status, "PAID");
  failQueue = false;
  assert.equal((await PUT(request('{"status":"PROCESSING"}'), context)).status, 200);
  assert.equal(status, "PROCESSING");
  assert.equal(queued, 1);
  assert.equal((await PUT(request('{"status":"PROCESSING"}'), context)).status, 200);
  assert.equal(queued, 1);
});

test("order status updates are blocked with descriptive 409 error when refund is requested or processing", async () => {
  refundRequested = true;
  const res = await PUT(request('{"status":"SHIPPED"}'), context);
  const data = await res.json();
  assert.equal(res.status, 409);
  assert.match(data.error, /refund is requested/);
  refundRequested = false;

  refundProcessing = true;
  const res2 = await PUT(request('{"status":"SHIPPED"}'), context);
  const data2 = await res2.json();
  assert.equal(res2.status, 409);
  assert.match(data2.error, /refund is processing/);
  refundProcessing = false;
});
