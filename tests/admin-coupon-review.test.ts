import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
let admin = true;
let failWrite = false;
let write: Record<string, any> | null = null;
const existing = { id: "coupon", type: "PRODUCT", discountType: "PERCENTAGE", discountValue: 10, code: "TEN", startDate: new Date("2026-01-01"), endDate: new Date("2027-01-01"), products: [{ productId: "old-product" }], categories: [] };
const db = { coupon: {
  findUnique: async () => existing,
  update: async ({ data }: { data: Record<string, any> }) => { if (failWrite) throw new Error("Atomic write failed"); write = data; return { ...existing, ...data }; },
} };
require.cache[require.resolve("../lib/db")] = { exports: { db } } as NodeModule;
require.cache[require.resolve("../lib/admin-auth")] = { exports: { hasFreshAdminSession: async () => admin } } as NodeModule;
const { PUT, DELETE } = require("../app/api/admin/coupons/[id]/route") as typeof import("../app/api/admin/coupons/[id]/route");
const context = { params: Promise.resolve({ id: "coupon" }) };
const request = (body: unknown) => new NextRequest("https://shop.example/api", { method: "PUT", body: JSON.stringify(body) });

test("coupon edits reject demoted admins and invalid merged values", async () => {
  admin = false;
  assert.equal((await PUT(request({ name: "New" }), context)).status, 401);
  assert.equal((await DELETE(request({}), context)).status, 401);
  admin = true;
  for (const body of [{ discountValue: 101 }, { startDate: "2028-01-01" }, { type: "CATEGORY" }]) {
    assert.equal((await PUT(request(body), context)).status, 400);
  }
});

test("coupon edits clear dates and replace restrictions in one nested database write", async t => {
  const response = await PUT(request({ endDate: null, productIds: ["new-product", "new-product"] }), context);
  assert.equal(response.status, 200);
  assert.equal(write?.endDate, null);
  assert.deepEqual(write?.products, { deleteMany: {}, create: [{ productId: "new-product" }] });
  assert.deepEqual(write?.categories, { deleteMany: {}, create: [] });
  write = null; failWrite = true;
  t.mock.method(console, "error", () => {});
  assert.equal((await PUT(request({ type: "GLOBAL" }), context)).status, 500);
  assert.equal(write, null);
});
