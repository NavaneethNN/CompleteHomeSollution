import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
const id = "c1234567890123456789012345";
let isAdmin = true;
let order: Record<string, any>;
let eligible = true;
let createCalls = 0;
let createFails = false;
let detailReference = id;

const db = {
  order: {
    findUnique: async () => structuredClone(order),
    updateMany: async ({ where, data }: any) => {
      if (where.ship123OrderNo === null && order.ship123OrderNo !== null) return { count: 0 };
      if (where.ship123CreateState === null && order.ship123CreateState !== null) return { count: 0 };
      if (typeof where.ship123CreateState === "string" && order.ship123CreateState !== where.ship123CreateState) return { count: 0 };
      Object.assign(order, data); return { count: 1 };
    },
    update: async ({ data }: any) => { Object.assign(order, data); return order; },
  },
};
function stub(path: string, exports: unknown) { require.cache[require.resolve(path)] = { exports } as NodeModule; }
const actual = require("../lib/ship123");
stub("../lib/db", { db });
stub("../lib/admin-auth", { hasFreshAdminSession: async () => isAdmin });
stub("../lib/ship123", {
  ...actual,
  getEligibleShip123Products: async () => eligible ? [{ code: "DHL_EXPRESS", name: "DHL Express", carrier: "DHL" }] : [],
  ship123SenderFromEnv: () => ({ name: "Sender", line1: "1 Test Street", suburb: "Melbourne", state: "VIC", postcode: "3000", phone: "0400000000" }),
  createShip123Order: async () => { createCalls++; if (createFails) throw new actual.Ship123Error("Unknown creation outcome"); return "SHIP-1"; },
  getShip123OrderDetail: async (orderNo: string) => ({ orderNo, customerOrderNo: detailReference, productCode: "DHL_EXPRESS", orderStatus: 2,
    trackNo: "TRACK-1", labelFile: { labelUrl: "https://labels.example/label.pdf" } }),
});
const route = require("../app/api/admin/orders/[orderId]/ship123/route") as typeof import("../app/api/admin/orders/[orderId]/ship123/route");
const context = { params: Promise.resolve({ orderId: id }) };
function request(body: unknown) { return new NextRequest(`https://shop.example/api/admin/orders/${id}/ship123`, { method: "POST", body: JSON.stringify(body) }); }
function reset() {
  isAdmin = true; eligible = true; createCalls = 0; createFails = false; detailReference = id;
  order = {
    id, status: "PAID", shippingServiceCode: "DHL_EXPRESS", ship123OrderNo: null, ship123LabelUrl: null,
    ship123CreateState: null, ship123CreateStartedAt: null, trackingNumber: null, carrier: null,
    address: { name: "Buyer", line1: "2 Test Street", line2: null, suburb: "Sydney", state: "NSW", postcode: "2000", phone: "0400000000" },
    user: { email: "buyer@example.com" }, guestEmail: null,
    items: [{ id: "item", quantity: 2, unitPrice: 10,
      product: { name: "Lamp", sku: "LAMP", weight: 1, length: 20, width: 15, height: 10 }, productVariant: null }],
  };
}

test("Ship123 admin action requires an admin and an eligible carrier", async () => {
  reset(); isAdmin = false;
  assert.equal((await route.POST(request({ productCode: "DHL_EXPRESS" }), context)).status, 401);
  isAdmin = true; eligible = false;
  assert.equal((await route.POST(request({ productCode: "DHL_EXPRESS" }), context)).status, 422);
  assert.equal(createCalls, 0);
});

test("manual Ship123 creation saves one order number and refreshes its label without re-creating", async () => {
  reset();
  const first = await route.POST(request({ productCode: "DHL_EXPRESS" }), context);
  assert.equal(first.status, 200);
  assert.equal(order.ship123OrderNo, "SHIP-1");
  assert.equal(order.trackingNumber, "TRACK-1");
  assert.equal(order.ship123LabelUrl, "https://labels.example/label.pdf");
  assert.equal(createCalls, 1);
  assert.equal((await route.POST(request({ productCode: "DHL_EXPRESS" }), context)).status, 200);
  assert.equal(createCalls, 1);
  eligible = false;
  assert.equal((await route.POST(request({ productCode: "DHL_EXPRESS" }), context)).status, 200);
  assert.equal(createCalls, 1);
});

test("unknown Ship123 creation blocks duplicates and only attaches a matching existing order", async t => {
  reset(); createFails = true;
  t.mock.method(console, "error", () => {});
  assert.equal((await route.POST(request({ productCode: "DHL_EXPRESS" }), context)).status, 503);
  assert.equal(order.ship123CreateState, "UNKNOWN");
  assert.equal((await route.POST(request({ productCode: "DHL_EXPRESS" }), context)).status, 409);
  assert.equal(createCalls, 1);
  detailReference = "different-order";
  assert.equal((await route.POST(request({ productCode: "DHL_EXPRESS", knownOrderNo: "SHIP-1" }), context)).status, 503);
  assert.equal(order.ship123OrderNo, null);
  detailReference = id;
  assert.equal((await route.POST(request({ productCode: "DHL_EXPRESS", knownOrderNo: "SHIP-1" }), context)).status, 200);
  assert.equal(order.ship123OrderNo, "SHIP-1");
  assert.equal(createCalls, 1);
});
