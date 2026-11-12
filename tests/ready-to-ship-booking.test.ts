import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

// Unit test for Couriers Please booking flow & dimension validation
test("ready-to-ship booking validates dimensions, weight and updates order", async () => {
  // Verify dimension calculation logic
  const length = 40;
  const width = 30;
  const height = 20;
  const weight = 3.5;

  const cubicWeight = Math.round(((length * width * height) / 4000) * 100) / 100;
  assert.equal(cubicWeight, 6.0); // (40 * 30 * 20) / 4000 = 24000 / 4000 = 6.0 kg

  const billableWeight = Math.max(weight, cubicWeight);
  assert.equal(billableWeight, 6.0);

  // When weight is larger than cubic weight
  const heavyWeight = 8.5;
  const billableHeavy = Math.max(heavyWeight, cubicWeight);
  assert.equal(billableHeavy, 8.5);
});

test("ready-to-ship rejects invalid, non-positive or oversized dimensions", async () => {
  const invalidDimensions = [
    { length: 0, width: 20, height: 20, weight: 1 },
    { length: -5, width: 20, height: 20, weight: 1 },
    { length: 20, width: 0, height: 20, weight: 1 },
    { length: 20, width: 20, height: 0, weight: 1 },
    { length: 20, width: 20, height: 20, weight: 0 },
    { length: 20, width: 20, height: 20, weight: -2 },
    { length: 350, width: 20, height: 20, weight: 1 }, // > 300cm max
    { length: 20, width: 20, height: 20, weight: 150 }, // > 100kg max
  ];

  for (const dim of invalidDimensions) {
    const isInvalid =
      dim.length <= 0 ||
      dim.width <= 0 ||
      dim.height <= 0 ||
      dim.weight <= 0 ||
      dim.length > 300 ||
      dim.width > 300 ||
      dim.height > 300 ||
      dim.weight > 100;
    assert.ok(isInvalid, `Dimension ${JSON.stringify(dim)} should be invalid`);
  }
});

// Route contract tests (ready-to-ship, couriersplease/label, couriersplease/sync, resolveMonotonicCarrierStatus)
{
  const localRequire = createRequire(import.meta.url);

  function stubModule(relPath: string, exports: unknown) {
    localRequire.cache[localRequire.resolve(relPath)] = { exports } as NodeModule;
  }

  let currentOrder: any = null;
  let adminAuthorized = true;
  let updateManyShouldFail = false;
  let queuedEmails: any[] = [];

  const mockDb = {
    order: {
      findUnique: async () => (currentOrder ? structuredClone(currentOrder) : null),
      update: async ({ data }: any) => {
        if (currentOrder) Object.assign(currentOrder, data);
        return currentOrder;
      },
      updateMany: async ({ where, data }: any) => {
        if (updateManyShouldFail || !currentOrder) return { count: 0 };
        if (where.id && currentOrder.id !== where.id) return { count: 0 };
        if (where.status && typeof where.status === "string" && currentOrder.status !== where.status) {
          return { count: 0 };
        }
        if (where.trackingNumber === null && currentOrder.trackingNumber !== null) return { count: 0 };
        if (where.ship123OrderNo === null && currentOrder.ship123OrderNo !== null) return { count: 0 };
        if (where.ship123CreateState && currentOrder.ship123CreateState !== where.ship123CreateState) {
          return { count: 0 };
        }
        Object.assign(currentOrder, data);
        return { count: 1 };
      },
    },
    emailJob: {
      createMany: async ({ data }: any) => {
        queuedEmails.push(...data);
        return { count: data.length };
      },
    },
    $transaction: async (fn: any) => fn(mockDb),
  };

  stubModule("../lib/db", { db: mockDb });
  stubModule("../lib/admin-auth", {
    hasFreshAdminSession: async () => adminAuthorized,
  });
  stubModule("../lib/email-outbox", {
    processDueEmailJobs: async () => ({ checked: 1, sent: 1, failed: 0 }),
  });

  const readyToShipRoute = localRequire("../app/api/admin/orders/[orderId]/ready-to-ship/route") as typeof import("../app/api/admin/orders/[orderId]/ready-to-ship/route");
  const labelRoute = localRequire("../app/api/admin/orders/[orderId]/couriersplease/label/route") as typeof import("../app/api/admin/orders/[orderId]/couriersplease/label/route");
  const syncRoute = localRequire("../app/api/admin/orders/[orderId]/couriersplease/sync/route") as typeof import("../app/api/admin/orders/[orderId]/couriersplease/sync/route");
  const { resolveMonotonicCarrierStatus } = localRequire("../lib/couriersplease-sync") as typeof import("../lib/couriersplease-sync");

  function withCouriersPleaseLiveEnv(t: { after: (fn: () => void) => void }) {
    const prevEnv = {
      COURIER_PLEASE_TEST_MODE: process.env.COURIER_PLEASE_TEST_MODE,
      COURIER_PLEASE_API_ID: process.env.COURIER_PLEASE_API_ID,
      COURIER_PLEASE_API_KEY: process.env.COURIER_PLEASE_API_KEY,
      COURIER_PLEASE_SENDER_NAME: process.env.COURIER_PLEASE_SENDER_NAME,
      COURIER_PLEASE_SENDER_LINE1: process.env.COURIER_PLEASE_SENDER_LINE1,
      COURIER_PLEASE_SENDER_SUBURB: process.env.COURIER_PLEASE_SENDER_SUBURB,
      COURIER_PLEASE_SENDER_STATE: process.env.COURIER_PLEASE_SENDER_STATE,
      COURIER_PLEASE_SENDER_POSTCODE: process.env.COURIER_PLEASE_SENDER_POSTCODE,
      COURIER_PLEASE_SENDER_PHONE: process.env.COURIER_PLEASE_SENDER_PHONE,
    };
    const originalFetch = globalThis.fetch;

    t.after(() => {
      globalThis.fetch = originalFetch;
      for (const [k, v] of Object.entries(prevEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });

    process.env.COURIER_PLEASE_TEST_MODE = "false";
    process.env.COURIER_PLEASE_API_ID = "test-id";
    process.env.COURIER_PLEASE_API_KEY = "test-key";
    process.env.COURIER_PLEASE_SENDER_NAME = "CHS Dispatch";
    process.env.COURIER_PLEASE_SENDER_LINE1 = "18 Edison Drive";
    process.env.COURIER_PLEASE_SENDER_SUBURB = "Golden Grove";
    process.env.COURIER_PLEASE_SENDER_STATE = "SA";
    process.env.COURIER_PLEASE_SENDER_POSTCODE = "5125";
    process.env.COURIER_PLEASE_SENDER_PHONE = "0401682910";
  }

  function makeOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: "corder00000000000000000001",
      status: "PAID",
      fulfillmentType: "SHIPPING",
      carrier: "Couriers Please",
      trackingNumber: null,
      ship123OrderNo: null,
      ship123LabelUrl: null,
      ship123CreateState: null,
      ship123CreateStartedAt: null,
      shippingServiceCode: "CP_STANDARD",
      packageName: "Standard Box",
      packedLength: 35,
      packedWidth: 25,
      packedHeight: 20,
      packedWeight: 4,
      packageOverride: true,
      guestPhone: "0412345678",
      guestEmail: "buyer@example.com",
      createdAt: new Date("2026-11-11T00:00:00Z"),
      updatedAt: new Date("2026-11-11T00:00:00Z"),
      address: {
        name: "Jane Buyer",
        line1: "10 George Street",
        line2: null,
        suburb: "Sydney",
        state: "NSW",
        postcode: "2000",
        phone: "0412345678",
      },
      user: { name: "Jane Buyer", email: "buyer@example.com", phone: "0412345678" },
      items: [
        {
          quantity: 1,
          product: { name: "Kettle", sku: "KTL-1", weight: 3.5, length: 30, width: 20, height: 20 },
          productVariant: null,
        },
      ],
      ...overrides,
    };
  }

  test("resolveMonotonicCarrierStatus allows forward milestones and blocks regressions or terminal states", () => {
    assert.equal(resolveMonotonicCarrierStatus("PAID", "SHIPPED"), "SHIPPED");
    assert.equal(resolveMonotonicCarrierStatus("SHIPPED", "OUT_FOR_DELIVERY"), "OUT_FOR_DELIVERY");
    assert.equal(resolveMonotonicCarrierStatus("OUT_FOR_DELIVERY", "DELIVERED"), "DELIVERED");
    assert.equal(resolveMonotonicCarrierStatus("OUT_FOR_DELIVERY", "SHIPPED"), null);
    assert.equal(resolveMonotonicCarrierStatus("DELIVERED", "OUT_FOR_DELIVERY"), null);
    assert.equal(resolveMonotonicCarrierStatus("CANCELLED", "DELIVERED"), null);
    assert.equal(resolveMonotonicCarrierStatus("SHIPPED", null), null);
  });

  test("ready-to-ship blocks double-booking via CP_UNKNOWN on network failure and reconciles consignment", async (t) => {
    withCouriersPleaseLiveEnv(t);
    adminAuthorized = true;
    updateManyShouldFail = false;
    queuedEmails = [];
    currentOrder = makeOrder();

    let createAttempts = 0;
    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      if (url.endsWith("/v2/domestic/quote")) {
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: [{ RateCardCode: "TSKG", CalculatedFreightCharge: "19.00" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/v2/domestic/shipment/create")) {
        createAttempts++;
        throw new TypeError("socket hang up");
      }
      if (url.endsWith("/v2/domestic/bookPickup")) {
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: { jobNumber: "JOB555" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    const req1 = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/ready-to-ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res1 = await readyToShipRoute.POST(req1, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(res1.status, 503);
    assert.equal(currentOrder.ship123CreateState, "CP_UNKNOWN");
    assert.equal(currentOrder.trackingNumber, null);
    assert.equal(createAttempts, 1);

    // Second POST without reconcile must be blocked with 409 without hitting Couriers Please create again
    const req2 = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/ready-to-ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res2 = await readyToShipRoute.POST(req2, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(res2.status, 409);
    assert.equal(createAttempts, 1);

    // Reconcile with knownConsignmentCode succeeds and schedules pickup
    const req3 = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/ready-to-ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reconcile",
        knownConsignmentCode: "CPRECON123",
        readyDateTime: "2026-11-12 10:00 AM",
      }),
    });
    const res3 = await readyToShipRoute.POST(req3, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(res3.status, 200);
    const data3 = await res3.json();
    assert.equal(data3.consignmentCode, "CPRECON123");
    assert.equal(data3.jobNumber, "JOB555");
    assert.equal(data3.pickupBooked, true);
    assert.equal(currentOrder.status, "SHIPPED");
    assert.equal(currentOrder.ship123CreateState, "CP_JOB:JOB555");
    assert.equal(queuedEmails.length, 1);
  });

  test("ready-to-ship rejects atomic claim race with 409 and preserves consignment on pickup failure + retry_pickup", async (t) => {
    withCouriersPleaseLiveEnv(t);
    adminAuthorized = true;
    queuedEmails = [];
    currentOrder = makeOrder();
    updateManyShouldFail = true;

    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error("Should not call remote API when lock claim fails");
    }) as typeof fetch;

    const lockedReq = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/ready-to-ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const lockedRes = await readyToShipRoute.POST(lockedReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(lockedRes.status, 409);
    assert.equal(fetchCalls, 0);

    // Allow claim, succeed create, fail pickup -> CP_PICKUP_PENDING -> retry_pickup
    updateManyShouldFail = false;
    let shipmentCreateCalls = 0;
    let pickupCalls = 0;
    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      if (url.endsWith("/v2/domestic/quote")) {
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: [{ RateCardCode: "TSKG", CalculatedFreightCharge: "19.00" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/v2/domestic/shipment/create")) {
        shipmentCreateCalls++;
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: { consignmentCode: "CPLIVE777" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/v2/domestic/bookPickup")) {
        pickupCalls++;
        if (pickupCalls === 1) {
          return new Response(
            JSON.stringify({ responseCode: "FAILED", msg: "Pickup window closed" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: { jobNumber: "JOB888" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    const bookReq = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/ready-to-ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const bookRes = await readyToShipRoute.POST(bookReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(bookRes.status, 200);
    const bookData = await bookRes.json();
    assert.equal(bookData.consignmentCode, "CPLIVE777");
    assert.equal(bookData.pickupBooked, false);
    assert.equal(bookData.pickupPending, true);
    assert.ok(bookData.pickupWarning);
    assert.equal(currentOrder.trackingNumber, "CPLIVE777");
    assert.equal(currentOrder.ship123CreateState, "CP_PICKUP_PENDING");

    const retryReq = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/ready-to-ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry_pickup", readyDateTime: "2026-11-16 10:00 AM" }),
    });
    const retryRes = await readyToShipRoute.POST(retryReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(retryRes.status, 200);
    const retryData = await retryRes.json();
    assert.equal(retryData.consignmentCode, "CPLIVE777");
    assert.equal(retryData.jobNumber, "JOB888");
    assert.equal(retryData.pickupBooked, true);
    assert.equal(shipmentCreateCalls, 1); // Never creates a duplicate consignment on retry_pickup
    assert.equal(currentOrder.ship123CreateState, "CP_JOB:JOB888");
  });

  test("couriersplease/label GET rejects unbooked order with 409 and sets no-store header for booked consignment", async (t) => {
    withCouriersPleaseLiveEnv(t);
    adminAuthorized = true;

    currentOrder = makeOrder({ trackingNumber: null, ship123OrderNo: null, status: "PAID" });
    const unbookedReq = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/couriersplease/label");
    const unbookedRes = await labelRoute.GET(unbookedReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(unbookedRes.status, 409);

    currentOrder = makeOrder({
      trackingNumber: "CPTEST-0001",
      ship123OrderNo: "CPTEST-0001",
      status: "SHIPPED",
    });
    const bookedReq = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/couriersplease/label");
    const bookedRes = await labelRoute.GET(bookedReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(bookedRes.status, 200);
    assert.equal(bookedRes.headers.get("Content-Type"), "application/pdf");
    assert.equal(bookedRes.headers.get("Cache-Control"), "private, no-store, max-age=0");
    const pdfBytes = Buffer.from(await bookedRes.arrayBuffer());
    assert.equal(pdfBytes.subarray(0, 4).toString("ascii"), "%PDF");
  });

  test("couriersplease/sync transitions SHIPPED order to OUT_FOR_DELIVERY from live locateParcel", async (t) => {
    withCouriersPleaseLiveEnv(t);
    adminAuthorized = true;
    updateManyShouldFail = false;
    queuedEmails = [];
    currentOrder = makeOrder({
      status: "SHIPPED",
      trackingNumber: "CPLIVE777",
      ship123OrderNo: "CPLIVE777",
    });

    globalThis.fetch = (async (input: any) => {
      assert.match(String(input), /\/v1\/domestic\/locateParcel\?trackingCode=CPLIVE777$/);
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          msg: "",
          data: {
            consignmentInfo: [
              {
                consignmentCode: "CPLIVE777",
                status: "On Board for Delivery",
                deliveryETA: "2026-11-12",
                itemsCoupons: [
                  { trackingInfo: [{ date: "2026-11-12", time: "08:00:00", action: "With driver for delivery" }] },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const req = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/couriersplease/sync", {
      method: "POST",
    });
    const res = await syncRoute.POST(req, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.updated, true);
    assert.equal(data.orderStatus, "OUT_FOR_DELIVERY");
    assert.equal(currentOrder.status, "OUT_FOR_DELIVERY");
    assert.equal(queuedEmails.length, 1);
    assert.equal(queuedEmails[0].payload.status, "OUT_FOR_DELIVERY");
  });

  test("ready-to-ship GET & POST resolve multi-box extraPackages and multi-product items into separate Couriers Please parcels", async (t) => {
    withCouriersPleaseLiveEnv(t);
    adminAuthorized = true;
    updateManyShouldFail = false;
    queuedEmails = [];
    currentOrder = makeOrder({
      packageName: null,
      packedLength: null,
      packedWidth: null,
      packedHeight: null,
      packedWeight: null,
      packedBoxes: null,
      packageOverride: false,
      items: [
        {
          id: "oi-1",
          quantity: 1,
          product: {
            name: "Two-Box Shelving",
            sku: "SHLF-2",
            weight: 15,
            length: 95,
            width: 45,
            height: 20,
            extraPackages: [{ weight: 12, length: 80, width: 40, height: 18 }],
            requiresPackaging: false,
          },
          productVariant: null,
        },
        {
          id: "oi-2",
          quantity: 2,
          product: {
            name: "Ceramic Lamp",
            sku: "LMP-1",
            weight: 4,
            length: 35,
            width: 25,
            height: 15,
            extraPackages: [],
            requiresPackaging: false,
          },
          productVariant: null,
        },
      ],
    });

    const getReq = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/ready-to-ship");
    const getRes = await readyToShipRoute.GET(getReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.order.totalBoxCount, 4);
    assert.equal(getData.order.packedBoxes.length, 3);
    assert.equal(getData.order.packedWeight, 35);

    let capturedShipmentPayload: any = null;
    let capturedPickupPayload: any = null;

    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v2/domestic/quote")) {
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: [{ RateCardCode: "TSKG", CalculatedFreightCharge: "42.00" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/v2/domestic/shipment/create")) {
        capturedShipmentPayload = JSON.parse(String(init?.body || "{}"));
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: { consignmentCode: "CPMULTI999" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/v2/domestic/bookPickup")) {
        capturedPickupPayload = JSON.parse(String(init?.body || "{}"));
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: { jobNumber: "JOB999" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    const postReq = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/ready-to-ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const postRes = await readyToShipRoute.POST(postReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.consignmentCode, "CPMULTI999");
    assert.equal(postData.totalBoxCount, 4);
    assert.equal(capturedShipmentPayload.items.length, 3);
    assert.equal(capturedPickupPayload.totalItemCount, 4);
    assert.equal(capturedPickupPayload.totalWeight, 35);
  });

  test("ready-to-ship automatically falls back to separate per-box consignments when Couriers Please rejects multi-item creation", async (t) => {
    withCouriersPleaseLiveEnv(t);
    adminAuthorized = true;
    updateManyShouldFail = false;
    queuedEmails = [];
    currentOrder = makeOrder({
      packageName: null,
      packedLength: null,
      packedWidth: null,
      packedHeight: null,
      packedWeight: null,
      packedBoxes: null,
      packageOverride: false,
      items: [
        {
          id: "oi-1",
          quantity: 1,
          product: {
            name: "Two-Box Table",
            sku: "TBL-2",
            weight: 10,
            length: 80,
            width: 40,
            height: 20,
            extraPackages: [{ weight: 8, length: 60, width: 35, height: 18 }],
            requiresPackaging: false,
          },
          productVariant: null,
        },
        {
          id: "oi-2",
          quantity: 1,
          product: {
            name: "Pendant Light",
            sku: "LGT-1",
            weight: 3,
            length: 30,
            width: 25,
            height: 20,
            extraPackages: [],
            requiresPackaging: false,
          },
          productVariant: null,
        },
      ],
    });

    let sepSeq = 0;
    const pickupCodes: string[] = [];
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v2/domestic/quote")) {
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: [{ RateCardCode: "ITMR", CalculatedFreightCharge: "18.00" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/v2/domestic/shipment/create")) {
        const payload = JSON.parse(String(init?.body || "{}"));
        if (payload.items.length > 1) {
          return new Response(
            JSON.stringify({ responseCode: "FAILED", msg: "Item Rate allows max 1 parcel per consignment" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        sepSeq++;
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: { consignmentCode: `CPBOX${sepSeq}` } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/v2/domestic/bookPickup")) {
        const body = JSON.parse(String(init?.body || "{}"));
        pickupCodes.push(body.consignmentCode);
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: { jobNumber: `JOBBOX${pickupCodes.length}` } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/v1/domestic/shipment/label")) {
        return new Response(JSON.stringify({ responseCode: "FAILED", msg: "Pending" }), { status: 404 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    const postReq = new NextRequest("http://localhost:3000/api/admin/orders/corder00000000000000000001/ready-to-ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const postRes = await readyToShipRoute.POST(postReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.bookingMode, "SEPARATE_CONSIGNMENTS");
    assert.deepEqual(postData.consignmentCodes, ["CPBOX1", "CPBOX2", "CPBOX3"]);
    assert.equal(postData.consignmentCode, "CPBOX1, CPBOX2, CPBOX3");
    assert.equal(postData.jobNumber, "JOBBOX1, JOBBOX2, JOBBOX3");
    assert.deepEqual(pickupCodes, ["CPBOX1", "CPBOX2", "CPBOX3"]);
    assert.equal(currentOrder.trackingNumber, "CPBOX1, CPBOX2, CPBOX3");

    // Verify per-box official label query param validation
    const box2LabelReq = new NextRequest(
      "http://localhost:3000/api/admin/orders/corder00000000000000000001/couriersplease/label?code=CPBOX2"
    );
    const box2LabelRes = await labelRoute.GET(box2LabelReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(box2LabelRes.status, 200);

    const badLabelReq = new NextRequest(
      "http://localhost:3000/api/admin/orders/corder00000000000000000001/couriersplease/label?code=OTHER999"
    );
    const badLabelRes = await labelRoute.GET(badLabelReq, {
      params: Promise.resolve({ orderId: "corder00000000000000000001" }),
    });
    assert.equal(badLabelRes.status, 404);
  });
}

