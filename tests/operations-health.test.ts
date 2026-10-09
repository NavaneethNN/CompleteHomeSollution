import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
const secret = "operations-health-test-secret-0123456789";
process.env.CRON_SECRET = secret;
let counts = [0, 0, 0, 0, 0];
let index = 0;
let fail = false;
const count = async () => {
  if (fail) throw new Error("Database unavailable");
  return counts[index++] ?? 0;
};
const db = { order: { count }, emailJob: { count }, stockAlert: { count } };
require.cache[require.resolve("../lib/db")] = { exports: { db } } as NodeModule;
const { GET } = require("../app/api/health/operations/route") as typeof import("../app/api/health/operations/route");
const authorized = new NextRequest("https://shop.example/api/health/operations", { headers: { authorization: `Bearer ${secret}` } });

test("operations health is private and reports overdue payment and fulfillment work", async () => {
  assert.equal((await GET(new NextRequest("https://shop.example/api/health/operations"))).status, 401);
  index = 0; counts = [0, 0, 0, 0, 0];
  const healthy = await GET(authorized);
  assert.equal(healthy.status, 200);
  assert.equal((await healthy.json()).status, "ok");

  index = 0; counts = [0, 0, 0, 1, 0];
  const payment = await GET(authorized);
  assert.equal(payment.status, 503);
  assert.equal((await payment.json()).paymentReviews, 1);

  index = 0; counts = [0, 0, 0, 0, 1];
  const fulfillment = await GET(authorized);
  assert.equal(fulfillment.status, 503);
  assert.equal((await fulfillment.json()).fulfillmentReviews, 1);

  fail = true;
  assert.equal((await GET(authorized)).status, 503);
  fail = false;
});
