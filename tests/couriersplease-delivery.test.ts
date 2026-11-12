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

test("Couriers Please webhook transitions SHIPPED order to OUT_FOR_DELIVERY and queues notification", async () => {
  mockOrder = {
    id: "corder12345678901234567891",
    status: "SHIPPED",
    trackingNumber: "CP88776655",
    carrier: "Couriers Please",
    user: { email: "customer@example.com", name: "Bob" },
    address: { name: "Bob", line1: "10 High St", suburb: "Adelaide", state: "SA", postcode: "5000" },
  };
  updatedOrderData = null;
  createdEmailJobs = [];

  const req = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consignmentNumber: "CP88776655",
      status: "With driver for delivery",
    }),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.previousStatus, "SHIPPED");
  assert.equal(data.newStatus, "OUT_FOR_DELIVERY");
  assert.ok(updatedOrderData);
  assert.equal((updatedOrderData as any).status, "OUT_FOR_DELIVERY");
  assert.equal(createdEmailJobs.length, 1);
  assert.equal(createdEmailJobs[0].payload.status, "OUT_FOR_DELIVERY");
});

test("Couriers Please webhook does not mark Attempted delivery as DELIVERED", async () => {
  mockOrder = {
    id: "corder12345678901234567892",
    status: "SHIPPED",
    trackingNumber: "CP44556677",
    carrier: "Couriers Please",
    user: { email: "customer@example.com", name: "Cara" },
    address: { name: "Cara" },
  };
  updatedOrderData = null;
  createdEmailJobs = [];

  const req = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consignmentNumber: "CP44556677",
      status: "Attempted to deliver parcel",
    }),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.alreadyProcessed, true);
  assert.equal(updatedOrderData, null);
  assert.equal(createdEmailJobs.length, 0);

  // Also ensure Attempted delivery never downgrades or marks DELIVERED when order is OUT_FOR_DELIVERY
  mockOrder.status = "OUT_FOR_DELIVERY";
  const req2 = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consignmentNumber: "CP44556677",
      status: "Attempted to deliver parcel",
    }),
  });
  const res2 = await route.POST(req2);
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.ignored, true);
  assert.equal(updatedOrderData, null);
  assert.equal(createdEmailJobs.length, 0);
});

test("Couriers Please webhook enforces monotonic status and ignores out-of-order In Transit after OUT_FOR_DELIVERY", async () => {
  mockOrder = {
    id: "corder12345678901234567893",
    status: "OUT_FOR_DELIVERY",
    trackingNumber: "CP11223344",
    carrier: "Couriers Please",
    user: { email: "customer@example.com", name: "Dan" },
    address: { name: "Dan" },
  };
  updatedOrderData = null;
  createdEmailJobs = [];

  const req = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consignmentNumber: "CP11223344",
      status: "In Transit",
    }),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ignored, true);
  assert.equal(updatedOrderData, null);
  assert.equal(createdEmailJobs.length, 0);
});

test("Couriers Please webhook verifies x-couriersplease-secret and parses nested consignmentInfo payload", async (t) => {
  const prevSecret = process.env.COURIERS_PLEASE_WEBHOOK_SECRET;
  const prevAltSecret = process.env.COURIER_PLEASE_WEBHOOK_SECRET;
  t.after(() => {
    if (prevSecret === undefined) delete process.env.COURIERS_PLEASE_WEBHOOK_SECRET;
    else process.env.COURIERS_PLEASE_WEBHOOK_SECRET = prevSecret;
    if (prevAltSecret === undefined) delete process.env.COURIER_PLEASE_WEBHOOK_SECRET;
    else process.env.COURIER_PLEASE_WEBHOOK_SECRET = prevAltSecret;
  });

  process.env.COURIERS_PLEASE_WEBHOOK_SECRET = "cp-webhook-secret-2026";
  delete process.env.COURIER_PLEASE_WEBHOOK_SECRET;

  mockOrder = {
    id: "corder12345678901234567894",
    status: "OUT_FOR_DELIVERY",
    trackingNumber: "CPNESTED99",
    carrier: "Couriers Please",
    user: { email: "customer@example.com", name: "Eva" },
    address: { name: "Eva" },
  };
  updatedOrderData = null;
  createdEmailJobs = [];

  const unauthorizedReq = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-couriersplease-secret": "wrong-secret",
    },
    body: JSON.stringify({
      data: { consignmentInfo: [{ consignmentCode: "CPNESTED99", status: "POD" }] },
    }),
  });
  const unauthRes = await route.POST(unauthorizedReq);
  assert.equal(unauthRes.status, 401);
  assert.equal(updatedOrderData, null);

  const authorizedReq = new NextRequest("http://localhost:3000/api/webhooks/couriersplease", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-couriersplease-secret": "cp-webhook-secret-2026",
    },
    body: JSON.stringify({
      data: { consignmentInfo: [{ consignmentCode: "CPNESTED99", status: "POD" }] },
    }),
  });
  const okRes = await route.POST(authorizedReq);
  assert.equal(okRes.status, 200);
  const data = await okRes.json();
  assert.equal(data.newStatus, "DELIVERED");
  assert.ok(updatedOrderData);
  assert.equal((updatedOrderData as any).status, "DELIVERED");
  assert.equal(createdEmailJobs.length, 1);
  assert.equal(createdEmailJobs[0].payload.status, "DELIVERED");
});

