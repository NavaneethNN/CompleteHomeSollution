import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
const secret = "a".repeat(40);
process.env.CRON_SECRET = secret;
let stockSent = 0;
let orderSent = 0;
let failDelivery = false;
let jobKind = "ORDER_CUSTOMER";
let jobPayload: unknown = null;
let orderStatus = "PAID";
const receipts: Record<string, unknown>[] = [];
let replaceLease = false;
let stock = { claimUntil: null as Date | null, notifiedAt: null as Date | null, attempts: 0 };
let job = { status: "PENDING", claimUntil: null as Date | null, attempts: 0 };
let reviewJobs: string[] = [];
let backlog: string[] = [];
const queries: string[] = [];
const sameDate = (a: unknown, b: Date | null) => a instanceof Date && b?.getTime() === a.getTime();

const db = {
  $queryRaw: async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    queries.push(sql);
    if (sql.includes('FROM "StockAlert"')) return [{ id: "alert-1", email: "buyer@example.com", name: "Chair", slug: "chair" }];
    assert.match(sql, /NOT EXISTS/);
    if (sql.includes("'PENDING'")) return backlog.filter(id => !reviewJobs.includes(`order:${id}:payment-review`)).slice(0, 50).map(id => ({ id }));
    return [];
  },
  stockAlert: {
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (where.claimUntil && !sameDate(where.claimUntil, stock.claimUntil)) return { count: 0 };
      if (data.claimUntil instanceof Date) {
        if (stock.claimUntil && stock.claimUntil > new Date()) return { count: 0 };
        stock.claimUntil = data.claimUntil;
        stock.attempts++;
      } else {
        stock.claimUntil = null;
        if (data.notifiedAt instanceof Date) stock.notifiedAt = data.notifiedAt;
      }
      return { count: 1 };
    },
    findUnique: async () => stock,
  },
  emailJob: {
    createMany: async ({ data }: { data: { key: string }[] }) => { reviewJobs.push(...data.map(job => job.key)); return { count: data.length }; },
    findMany: async () => job.status === "SENT" ? [] : [{ id: "job-1", kind: jobKind, payload: jobPayload, orderId: "order-1", attempts: job.attempts }],
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (where.claimUntil && (!sameDate(where.claimUntil, job.claimUntil) || where.attempts !== job.attempts)) return { count: 0 };
      if (data.status === "CLAIMED") {
        if (job.status === "CLAIMED" && job.claimUntil && job.claimUntil > new Date()) return { count: 0 };
        job.attempts++;
      }
      job.status = data.status as string;
      job.claimUntil = data.claimUntil as Date | null;
      return { count: 1 };
    },
  },
  order: {
    findUnique: async () => ({ id: "order-1", status: orderStatus, total: 10, refundRequested: false, trackingNumber: "TRACK", carrier: "Courier",
      guestEmail: "buyer@example.com", user: null,
      address: { name: "Buyer", line1: "1 Road", suburb: "Sydney", state: "NSW", postcode: "2000", country: "AU" },
      items: [{ product: { name: "Chair" }, quantity: 1, unitPrice: 10 }],
    }),
  },
};
require.cache[require.resolve("../lib/db")] = { exports: { db } } as NodeModule;
require.cache[require.resolve("../lib/brevo")] = { exports: {
  sendEmail: async () => {
    stockSent++;
    if (replaceLease) stock.claimUntil = new Date(Date.now() + 600_000);
    if (failDelivery) throw new Error("Provider unavailable");
  },
  sendOrderCancellationEmail: async (params: Record<string, unknown>) => { receipts.push(params); if (failDelivery) throw new Error("Provider down"); },
  sendShippingUpdateEmail: async (params: Record<string, unknown>) => { receipts.push(params); if (failDelivery) throw new Error("Provider down"); },
  sendRefundRequestEmail: async (params: Record<string, unknown>) => { receipts.push(params); if (failDelivery) throw new Error("Provider down"); },
  sendOrderConfirmationEmail: async () => {
    orderSent++;
    if (replaceLease) { job.claimUntil = new Date(Date.now() + 600_000); job.attempts++; }
    if (failDelivery) throw new Error("Provider unavailable");
  },
} } as NodeModule;
const stockCron = require("../app/api/cron/send-stock-alerts/route") as typeof import("../app/api/cron/send-stock-alerts/route");
const emailCron = require("../app/api/cron/send-email-jobs/route") as typeof import("../app/api/cron/send-email-jobs/route");
const reviewCron = require("../app/api/cron/check-operations/route") as typeof import("../app/api/cron/check-operations/route");
const authorized = new NextRequest("https://shop.example/api/cron", { headers: { authorization: `Bearer ${secret}` } });
const unauthorized = new NextRequest("https://shop.example/api/cron");

function reset() {
  stock = { claimUntil: null, notifiedAt: null, attempts: 0 };
  job = { status: "PENDING", claimUntil: null, attempts: 0 };
  stockSent = orderSent = 0;
  failDelivery = replaceLease = false;
  jobKind = "ORDER_CUSTOMER"; jobPayload = null; orderStatus = "PAID"; receipts.length = 0;
}

test("notification crons require authorization and overlapping workers claim once", async () => {
  reset();
  assert.equal((await stockCron.GET(unauthorized)).status, 401);
  assert.equal((await emailCron.GET(unauthorized)).status, 401);
  await Promise.all([stockCron.GET(authorized), stockCron.GET(authorized)]);
  assert.equal(stockSent, 1);
  assert.ok(stock.notifiedAt);
  await Promise.all([emailCron.GET(authorized), emailCron.GET(authorized)]);
  assert.equal(orderSent, 1);
  assert.equal(job.status, "SENT");
});

test("failed deliveries release their own claims and can retry", async () => {
  reset(); failDelivery = true;
  assert.equal((await (await stockCron.GET(authorized)).json()).failed, 1);
  assert.equal((await (await emailCron.GET(authorized)).json()).failed, 1);
  assert.equal(stock.claimUntil, null);
  assert.equal(job.status, "PENDING");
  failDelivery = false;
  await stockCron.GET(authorized); await emailCron.GET(authorized);
  assert.ok(stock.notifiedAt);
  assert.equal(job.status, "SENT");
});

test("stale workers cannot complete or release a newer delivery lease", async () => {
  for (const failure of [false, true]) {
    reset(); replaceLease = true; failDelivery = failure;
    await stockCron.GET(authorized); await emailCron.GET(authorized);
    assert.equal(stock.notifiedAt, null);
    assert.ok(stock.claimUntil);
    assert.equal(job.status, "CLAIMED");
    assert.equal(job.attempts, 2);
  }
});

test("operations reviews advance beyond a full batch of unresolved orders", async () => {
  reviewJobs = [];
  backlog = Array.from({ length: 120 }, (_, i) => `order-${i}`);
  assert.equal((await reviewCron.GET(unauthorized)).status, 401);
  for (let i = 0; i < 4; i++) assert.equal((await reviewCron.GET(authorized)).status, 200);
  assert.equal(reviewJobs.length, 120);
  assert.equal(new Set(reviewJobs).size, 120);
  assert.ok(queries.some(sql => sql.includes("'PROCESSING'")));
});


test("refund worker sends the saved partial amount and audience after later full refund", async () => {
  reset();
  jobKind = "REFUND_RECEIPT"; orderStatus = "REFUNDED";
  jobPayload = { refundAmount: 3, autoRefunded: false, isPartial: true, audience: "customer" };
  failDelivery = true;
  await emailCron.GET(authorized);
  assert.equal(job.status, "PENDING");
  failDelivery = false;
  await emailCron.GET(authorized);
  assert.equal(job.status, "SENT");
  assert.equal(receipts[1].refundAmount, 3);
  assert.equal(receipts[1].audience, "customer");
  assert.equal(receipts[0].idempotencyKey, receipts[1].idempotencyKey);
});

test("shipping worker retries delivery with the same provider idempotency key", async () => {
  reset(); jobKind = "SHIPPING"; orderStatus = "SHIPPED";
  failDelivery = true;
  await emailCron.GET(authorized);
  assert.equal(job.status, "PENDING");
  failDelivery = false;
  await emailCron.GET(authorized);
  assert.equal(job.status, "SENT");
  assert.equal(receipts[1].trackingNumber, "TRACK");
  assert.equal(receipts[0].idempotencyKey, receipts[1].idempotencyKey);
});
