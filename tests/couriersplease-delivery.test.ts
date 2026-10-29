import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);

function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}

let mockOrder: any = null;
let updatedOrderData: any = null;
let createdEmailJobs: any[] = [];

const dbMock = {
  order: {
    findFirst: async () => (mockOrder ? structuredClone(mockOrder) : null),
    update: async ({ data }: any) => {
      updatedOrderData = data;
      if (mockOrder) Object.assign(mockOrder, data);
      return mockOrder;
    },
  },
  emailJob: {
    createMany: async ({ data }: any) => {
      createdEmailJobs.push(...data);
      return { count: data.length };
    },
  },
  $transaction: async (fn: any) => fn(dbMock),
};

stub("../lib/db", { db: dbMock });
stub("../lib/email-outbox", {
  processDueEmailJobs: async () => ({ checked: 1, sent: 1, failed: 0 }),
});

const route = require("../app/api/webhooks/couriersplease/route") as typeof import("../app/api/webhooks/couriersplease/route");

test("Couriers Please webhook handles missing payload gracefully", async () => {
  const req = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes("Missing consignmentNumber"));
});

test("Couriers Please webhook ignores non-transitioning informational events", async () => {
  const req = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consignmentNumber: "CPTEST-123456",
      status: "Manifest Created",
    }),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ignored, true);
  assert.equal(data.rawStatus, "Manifest Created");
});

test("Couriers Please webhook returns 404 for unknown order/consignment", async () => {
  mockOrder = null;
  const req = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consignmentNumber: "CPNONEXISTENT999",
      status: "Delivered",
    }),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error, "Order not found");
});

test("Couriers Please webhook transitions SHIPPED order to DELIVERED and triggers email", async () => {
  mockOrder = {
    id: "corder12345678901234567890",
    status: "SHIPPED",
    trackingNumber: "CP12345678",
    carrier: "Couriers Please",
    user: { email: "customer@example.com", name: "Alice" },
    address: { name: "Alice", line1: "123 Street", suburb: "Sydney", state: "NSW", postcode: "2000" },
  };
  updatedOrderData = null;
  createdEmailJobs = [];

  const req = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consignmentNumber: "CP12345678",
      status: "Delivered",
    }),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.newStatus, "DELIVERED");
  assert.equal(data.previousStatus, "SHIPPED");

  assert.equal(updatedOrderData.status, "DELIVERED");
  assert.equal(createdEmailJobs.length, 1);
  assert.equal(createdEmailJobs[0].kind, "ORDER_STATUS");
  assert.equal(createdEmailJobs[0].payload.status, "DELIVERED");
});

test("Couriers Please webhook handles already DELIVERED order idempotently", async () => {
  mockOrder = {
    id: "corder12345678901234567890",
    status: "DELIVERED",
    trackingNumber: "CP12345678",
    carrier: "Couriers Please",
    user: { email: "customer@example.com", name: "Alice" },
    address: { name: "Alice" },
  };
  updatedOrderData = null;
  createdEmailJobs = [];

  const req = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consignmentNumber: "CP12345678",
      status: "Delivered",
    }),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.alreadyProcessed, true);
  assert.equal(createdEmailJobs.length, 0); // No duplicate email queued
});

