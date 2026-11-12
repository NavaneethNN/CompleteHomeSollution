import assert from "node:assert/strict";
import test from "node:test";
import {
  couriersPleaseSenderFromEnv,
  checkCouriersPleaseAvailability,
  formatPickupDateTime,
  CouriersPleaseError,
} from "../lib/couriersplease";
import { getTrackingUrl } from "../lib/tracking-url";

test("couriersPleaseSenderFromEnv loads configured environment variables", () => {
  const sender = couriersPleaseSenderFromEnv();
  assert.equal(sender.name, "Complete Home Solution");
  assert.equal(sender.line1, "18 Edison Drive");
  assert.equal(sender.suburb, "Golden Grove");
  assert.equal(sender.state, "SA");
  assert.equal(sender.postcode, "5125");
  assert.ok(sender.phone);
});

test("checkCouriersPleaseAvailability checks required account and key", (t) => {
  const prevAccount = process.env.COURIER_PLEASE_ACCOUNT_ID;
  const prevKey = process.env.COURIER_PLEASE_API_KEY;

  t.after(() => {
    if (prevAccount !== undefined) process.env.COURIER_PLEASE_ACCOUNT_ID = prevAccount;
    else delete process.env.COURIER_PLEASE_ACCOUNT_ID;
    if (prevKey !== undefined) process.env.COURIER_PLEASE_API_KEY = prevKey;
    else delete process.env.COURIER_PLEASE_API_KEY;
  });

  // When credentials are set
  process.env.COURIER_PLEASE_ACCOUNT_ID = "113206585";
  process.env.COURIER_PLEASE_API_KEY = "test_key";
  assert.equal(checkCouriersPleaseAvailability().available, true);
  assert.equal(checkCouriersPleaseAvailability().reason, null);

  // When credentials are missing or empty
  process.env.COURIER_PLEASE_ACCOUNT_ID = "";
  process.env.COURIER_PLEASE_API_KEY = "";
  assert.equal(checkCouriersPleaseAvailability().available, false);
  assert.ok(checkCouriersPleaseAvailability().reason);
});

test("formatPickupDateTime formats properly for Couriers Please bookPickup API", () => {
  const d = new Date(2026, 9, 27, 9, 30); // 2026-10-27 09:30 AM
  const formatted = formatPickupDateTime(d);
  assert.match(formatted, /^2026-10-27 09:30 AM$/);

  const afternoon = new Date(2026, 9, 27, 14, 15); // 2026-10-27 02:15 PM
  assert.match(formatPickupDateTime(afternoon), /^2026-10-27 02:15 PM$/);
});

test("getTrackingUrl resolves Couriers Please tracking URLs correctly", async () => {
  const url = getTrackingUrl("Couriers Please", "CP99887766");
  assert.equal(url, "https://www.couriersplease.com.au/tools-track?no=CP99887766");

  const urlWithSpaces = getTrackingUrl("couriersplease", "CP 123 456");
  assert.equal(urlWithSpaces, "https://www.couriersplease.com.au/tools-track?no=CP%20123%20456");

  const { isSimulationTrackingCode } = await import("../lib/tracking-url");
  assert.equal(isSimulationTrackingCode("CPTEST-123456"), true);
  assert.equal(isSimulationTrackingCode("CP99887766"), false);
});

test("computeDefaultPickupDateTime schedules Adelaide weekday, cutoff, and weekend pickups", async () => {
  const { computeDefaultPickupDateTime } = await import("../lib/couriersplease");

  // 2026-11-11 22:00 UTC = 2026-11-12 08:30 ACDT (Thu morning -> same day 10:00 AM)
  assert.equal(
    computeDefaultPickupDateTime("SA", new Date("2026-11-11T22:00:00Z")),
    "2026-11-12 10:00 AM"
  );

  // 2026-11-12 00:00 UTC = 2026-11-12 10:30 ACDT (Thu midday -> +60m rounded = 11:30 AM)
  assert.equal(
    computeDefaultPickupDateTime("SA", new Date("2026-11-12T00:00:00Z")),
    "2026-11-12 11:30 AM"
  );

  // 2026-11-12 03:30 UTC = 2026-11-12 14:00 ACDT (after 1:30 PM cutoff -> next weekday 10:00 AM)
  assert.equal(
    computeDefaultPickupDateTime("SA", new Date("2026-11-12T03:30:00Z")),
    "2026-11-13 10:00 AM"
  );

  // 2026-11-13 04:00 UTC = 2026-11-13 14:30 ACDT (Fri afternoon -> Mon 10:00 AM)
  assert.equal(
    computeDefaultPickupDateTime("SA", new Date("2026-11-13T04:00:00Z")),
    "2026-11-16 10:00 AM"
  );
});

test("classifyCouriersPleaseStatus distinguishes delivery, partial, on-board, and attempt scans", async () => {
  const { classifyCouriersPleaseStatus } = await import("../lib/couriersplease");

  assert.deepEqual(classifyCouriersPleaseStatus("Delivered 1 of 1"), {
    normalizedStatus: "DELIVERED",
    isDelivered: true,
  });
  assert.deepEqual(classifyCouriersPleaseStatus("Delivered 1 of 2"), {
    normalizedStatus: "OUT_FOR_DELIVERY",
    isDelivered: false,
  });
  assert.deepEqual(classifyCouriersPleaseStatus("Attempted to deliver parcel"), {
    normalizedStatus: "SHIPPED",
    isDelivered: false,
  });
  assert.deepEqual(classifyCouriersPleaseStatus("On-board for delivery"), {
    normalizedStatus: "OUT_FOR_DELIVERY",
    isDelivered: false,
  });
  assert.deepEqual(classifyCouriersPleaseStatus("POD"), {
    normalizedStatus: "DELIVERED",
    isDelivered: true,
  });
  assert.deepEqual(classifyCouriersPleaseStatus("Picked up"), {
    normalizedStatus: "SHIPPED",
    isDelivered: false,
  });
});

test("bookCouriersPleasePickup enforces 15/19 char Couriers Please field limits", async (t) => {
  const prevEnv = {
    COURIER_PLEASE_TEST_MODE: process.env.COURIER_PLEASE_TEST_MODE,
    COURIER_PLEASE_API_ID: process.env.COURIER_PLEASE_API_ID,
    COURIER_PLEASE_API_KEY: process.env.COURIER_PLEASE_API_KEY,
    COURIER_PLEASE_SENDER_NAME: process.env.COURIER_PLEASE_SENDER_NAME,
    COURIER_PLEASE_SENDER_LINE1: process.env.COURIER_PLEASE_SENDER_LINE1,
    COURIER_PLEASE_SENDER_LINE2: process.env.COURIER_PLEASE_SENDER_LINE2,
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
  process.env.COURIER_PLEASE_API_ID = "test-api-id";
  process.env.COURIER_PLEASE_API_KEY = "test-api-key";
  process.env.COURIER_PLEASE_SENDER_NAME = "Very Long Sender Dispatch Name";
  process.env.COURIER_PLEASE_SENDER_LINE1 = "1234 Very Long Warehouse Avenue North";
  process.env.COURIER_PLEASE_SENDER_LINE2 = "Building Suite Number Ninety Nine";
  process.env.COURIER_PLEASE_SENDER_SUBURB = "Golden Grove";
  process.env.COURIER_PLEASE_SENDER_STATE = "SA";
  process.env.COURIER_PLEASE_SENDER_POSTCODE = "5125";
  process.env.COURIER_PLEASE_SENDER_PHONE = "+61 400 123 456 7890123";

  let sentBody: any = null;
  let calledUrl = "";
  globalThis.fetch = (async (input: any, init: any) => {
    calledUrl = String(input);
    sentBody = JSON.parse(String(init?.body || "{}"));
    return new Response(
      JSON.stringify({ responseCode: "SUCCESS", msg: "OK", data: { jobNumber: "JOB9988" } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  const { bookCouriersPleasePickup } = await import("../lib/couriersplease");
  const booked = await bookCouriersPleasePickup({
    consignmentCode: "CPREAL001",
    readyDateTime: "2026-11-12 10:00 AM",
    totalItemCount: 2,
    totalWeight: 5.5,
    pickupInstructions: "Ring bell at loading dock gate B",
    recipient: {
      name: "Very Long Customer Name Example",
      line1: "999 Very Long Delivery Street West",
      line2: "Apartment Complex Level Twenty",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
    },
  });

  assert.match(calledUrl, /\/v2\/domestic\/bookPickup$/);
  assert.equal(booked.jobNumber, "JOB9988");
  assert.ok(sentBody.contactName.length <= 15);
  assert.ok(sentBody.specialInstructions.length <= 15);
  assert.ok(sentBody.pickup.companyName.length <= 19);
  assert.ok(sentBody.pickup.address1.length <= 19);
  assert.ok(sentBody.pickup.address2.length <= 19);
  assert.ok(sentBody.pickup.phoneNumber.length <= 19);
  assert.ok(sentBody.delivery.companyName.length <= 19);
  assert.ok(sentBody.delivery.address1.length <= 19);
  assert.ok(sentBody.delivery.address2.length <= 19);
});

test("getCouriersPleaseTracking queries /v1/domestic/locateParcel and parses live payload", async (t) => {
  const prevEnv = {
    COURIER_PLEASE_TEST_MODE: process.env.COURIER_PLEASE_TEST_MODE,
    COURIER_PLEASE_API_ID: process.env.COURIER_PLEASE_API_ID,
    COURIER_PLEASE_API_KEY: process.env.COURIER_PLEASE_API_KEY,
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
  process.env.COURIER_PLEASE_API_ID = "test-api-id";
  process.env.COURIER_PLEASE_API_KEY = "test-api-key";

  let calledUrl = "";
  globalThis.fetch = (async (input: any) => {
    calledUrl = String(input);
    return new Response(
      JSON.stringify({
        responseCode: "SUCCESS",
        msg: "",
        data: {
          consignmentInfo: [
            {
              consignmentCode: "CPREAL001",
              status: "On Board for Delivery",
              deliveryETA: "2026-11-13",
              itemsCoupons: [
                {
                  trackingInfo: [
                    { date: "2026-11-12", time: "08:00:00", action: "No scan events found" },
                    { date: "2026-11-12", time: "09:15:00", action: "Picked up from depot", location: "Adelaide" },
                    { date: "2026-11-13", time: "07:45:00", action: "With driver for delivery", location: "Sydney" },
                  ],
                },
              ],
            },
          ],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  const { getCouriersPleaseTracking } = await import("../lib/couriersplease");
  const result = await getCouriersPleaseTracking("CPREAL001");

  assert.match(calledUrl, /\/v1\/domestic\/locateParcel\?trackingCode=CPREAL001$/);
  assert.ok(result);
  assert.equal(result.normalizedStatus, "OUT_FOR_DELIVERY");
  assert.equal(result.isDelivered, false);
  assert.equal(result.deliveryETA, "2026-11-13");
  assert.ok(result.events);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].description, "With driver for delivery");
});

test("createCouriersPleaseShipment resolves quoted rateCardCode instead of synthetic/obsolete code and fails when quotes empty", async (t) => {
  const prevEnv = {
    COURIER_PLEASE_TEST_MODE: process.env.COURIER_PLEASE_TEST_MODE,
    COURIER_PLEASE_API_ID: process.env.COURIER_PLEASE_API_ID,
    COURIER_PLEASE_API_KEY: process.env.COURIER_PLEASE_API_KEY,
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
  process.env.COURIER_PLEASE_API_ID = "test-api-id";
  process.env.COURIER_PLEASE_API_KEY = "test-api-key";

  const seenUrls: string[] = [];
  let createPayload: any = null;
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input);
    seenUrls.push(url);
    if (url.endsWith("/v2/domestic/quote")) {
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [
            { RateCardCode: "TSKG", RateCardDescription: "Road Express", CalculatedFreightCharge: "18.50" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.endsWith("/v2/domestic/shipment/validate")) {
      return new Response(
        JSON.stringify({ responseCode: "SUCCESS", msg: "Shipment Validation Successful", data: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.endsWith("/v2/domestic/shipment/create")) {
      createPayload = JSON.parse(String(init?.body || "{}"));
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          msg: "Created",
          data: { consignmentCode: "CPLIVE12345" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const { createCouriersPleaseShipment } = await import("../lib/couriersplease");
  const shipment = await createCouriersPleaseShipment({
    orderId: "ord-test-1001",
    recipient: {
      name: "Jane Customer",
      line1: "10 George Street",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      phone: "0412345678",
      email: "jane@example.com",
    },
    items: [{ quantity: 1, length: 40, width: 30, height: 25, weight: 12 }],
    rateCardId: "CP_STANDARD",
    specialInstructions: "Leave at front porch",
  });

  assert.equal(shipment.consignmentCode, "CPLIVE12345");
  assert.equal(shipment.rateCardId, "TSKG");
  assert.equal(createPayload.rateCardId, "TSKG");
  assert.ok(seenUrls.some((u) => u.endsWith("/v2/domestic/quote")));
  assert.ok(!seenUrls.some((u) => u.endsWith("/v2/domestic/shipment/validate")));
  assert.ok(seenUrls.some((u) => u.endsWith("/v2/domestic/shipment/create")));

  // Test mode uses /v2/domestic/shipment/validate instead of /create and never swallows validate network errors
  process.env.COURIER_PLEASE_TEST_MODE = "true";
  const testModeUrls: string[] = [];
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    testModeUrls.push(url);
    if (url.endsWith("/v2/domestic/quote")) {
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [{ RateCardCode: "TSKG", RateCardDescription: "Road Express", CalculatedFreightCharge: "18.50" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.endsWith("/v2/domestic/shipment/validate")) {
      return new Response(
        JSON.stringify({ responseCode: "SUCCESS", msg: "Shipment Validation Successful", data: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    throw new Error(`Unexpected Test Mode URL: ${url}`);
  }) as typeof fetch;

  const testShipment = await createCouriersPleaseShipment({
    orderId: "ord-test-validate-1",
    recipient: {
      name: "Jane Customer",
      line1: "10 George Street",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
    },
    items: [{ quantity: 1, length: 40, width: 30, height: 25, weight: 12 }],
    rateCardId: "CP_STANDARD",
  });
  assert.match(testShipment.consignmentCode, /^CPTEST-/);
  assert.equal(testShipment.rateCardId, "TSKG");
  assert.ok(testModeUrls.some((u) => u.endsWith("/v2/domestic/shipment/validate")));
  assert.ok(!testModeUrls.some((u) => u.endsWith("/v2/domestic/shipment/create")));

  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    if (url.endsWith("/v2/domestic/quote")) {
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [{ RateCardCode: "TSKG", RateCardDescription: "Road Express", CalculatedFreightCharge: "18.50" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    throw new TypeError("validate timeout");
  }) as typeof fetch;

  await assert.rejects(
    () =>
      createCouriersPleaseShipment({
        orderId: "ord-test-validate-fail",
        recipient: {
          name: "Jane Customer",
          line1: "10 George Street",
          suburb: "Sydney",
          state: "NSW",
          postcode: "2000",
        },
        items: [{ quantity: 1, length: 40, width: 30, height: 25, weight: 12 }],
      }),
    /unreachable/i
  );

  process.env.COURIER_PLEASE_TEST_MODE = "false";
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input);
    if (url.endsWith("/v2/domestic/quote")) {
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [
            { RateCardCode: "TSKG", RateCardDescription: "Road Express", CalculatedFreightCharge: "18.50" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.endsWith("/v2/domestic/shipment/create")) {
      createPayload = JSON.parse(String(init?.body || "{}"));
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          msg: "Created",
          data: { consignmentCode: "CPLIVE12345" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  // Also test stale/obsolete weight-invalid rateCard ("TS5" when live quote only returns "TSKG")
  createPayload = null;
  const shipment2 = await createCouriersPleaseShipment({
    orderId: "ord-test-1002",
    recipient: {
      name: "Jane Customer",
      line1: "10 George Street",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
    },
    items: [{ quantity: 1, length: 40, width: 30, height: 25, weight: 12 }],
    rateCardId: "TS5",
  });
  assert.equal(shipment2.rateCardId, "TSKG");
  assert.equal(createPayload.rateCardId, "TSKG");

  // Empty quotes must throw instead of falling back to bogus code
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ responseCode: "SUCCESS", data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  await assert.rejects(
    () =>
      createCouriersPleaseShipment({
        orderId: "ord-test-1003",
        recipient: {
          name: "Jane Customer",
          line1: "10 George Street",
          suburb: "Sydney",
          state: "NSW",
          postcode: "2000",
        },
        items: [{ quantity: 1, length: 40, width: 30, height: 25, weight: 12 }],
        rateCardId: "CP_STANDARD",
      }),
    /quote|rate|unavailable|empty|no /i
  );
});

test("getCouriersPleaseRates quotes per-box individually when multi-item quote is rejected by single-parcel rate card", async (t) => {
  const prevEnv = {
    COURIER_PLEASE_TEST_MODE: process.env.COURIER_PLEASE_TEST_MODE,
    COURIER_PLEASE_API_ID: process.env.COURIER_PLEASE_API_ID,
    COURIER_PLEASE_API_KEY: process.env.COURIER_PLEASE_API_KEY,
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
  process.env.COURIER_PLEASE_API_ID = "test-api-id";
  process.env.COURIER_PLEASE_API_KEY = "test-api-key";

  const quoteBodies: any[] = [];
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input);
    if (!url.endsWith("/v2/domestic/quote")) throw new Error(`Unexpected URL: ${url}`);
    const body = JSON.parse(String(init?.body || "{}"));
    quoteBodies.push(body);

    // Multi-item quote returns 400 (single-parcel restriction)
    const totalQty = (body.items || []).reduce((s: number, it: any) => s + Number(it.quantity || 1), 0);
    if (body.items.length > 1 || totalQty > 1) {
      return new Response(
        JSON.stringify({ responseCode: "FAILED", msg: "Item rate only allows 1 parcel per quote" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const weight = body.items[0].physicalWeight;
    const ratePrice = weight > 10 ? "22.50" : "14.00";
    return new Response(
      JSON.stringify({
        responseCode: "SUCCESS",
        data: [
          { RateCardCode: "ITMR", RateCardDescription: "Single Item Rate", CalculatedFreightCharge: ratePrice },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  const { getCouriersPleaseRates } = await import("../lib/couriersplease");
  const rates = await getCouriersPleaseRates(
    { suburb: "Sydney", state: "NSW", postcode: "2000" },
    [
      { weightKg: 12, lengthCm: 60, widthCm: 40, heightCm: 30, count: 2 },
      { weightKg: 5, lengthCm: 30, widthCm: 25, heightCm: 15, count: 1 },
    ]
  );

  assert.equal(quoteBodies.length, 3); // 1 multi-item attempt + 2 per-group single quotes
  assert.equal(rates.length, 1);
  assert.equal(rates[0].serviceCode, "ITMR");
  assert.equal(rates[0].price, 59); // 2 * 22.50 + 1 * 14.00
});

test("createCouriersPleaseDispatch uses multi-parcel when allowed and falls back to separate consignments on 4xx rejection", async (t) => {
  const prevEnv = {
    COURIER_PLEASE_TEST_MODE: process.env.COURIER_PLEASE_TEST_MODE,
    COURIER_PLEASE_API_ID: process.env.COURIER_PLEASE_API_ID,
    COURIER_PLEASE_API_KEY: process.env.COURIER_PLEASE_API_KEY,
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
  process.env.COURIER_PLEASE_API_ID = "test-api-id";
  process.env.COURIER_PLEASE_API_KEY = "test-api-key";

  const { createCouriersPleaseDispatch, CouriersPleasePartialBookingError } = await import("../lib/couriersplease");

  // Case 1: Native multi-parcel succeeds -> 1 consignment code
  let shipmentCounter = 0;
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input);
    if (url.endsWith("/v2/domestic/quote")) {
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [{ RateCardCode: "TSKG", CalculatedFreightCharge: "31.00" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.endsWith("/v2/domestic/shipment/create")) {
      shipmentCounter++;
      const payload = JSON.parse(String(init?.body || "{}"));
      assert.equal(payload.items[0].description, "Sofa Frame (Box 1)");
      assert.equal(payload.items[1].description, "Sofa Cushions (Box 2)");
      return new Response(
        JSON.stringify({ responseCode: "SUCCESS", data: { consignmentCode: "CPMULTI001" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const nativeResult = await createCouriersPleaseDispatch({
    orderId: "ord-multi-1",
    recipient: { name: "Bob Buyer", line1: "5 Queen St", suburb: "Melbourne", state: "VIC", postcode: "3000" },
    items: [
      { quantity: 1, length: 90, width: 45, height: 20, weight: 14, description: "Sofa Frame (Box 1)" },
      { quantity: 1, length: 60, width: 40, height: 25, weight: 8, description: "Sofa Cushions (Box 2)" },
    ],
  });
  assert.equal(nativeResult.bookingMode, "MULTI_PARCEL");
  assert.equal(nativeResult.consignmentCode, "CPMULTI001");
  assert.deepEqual(nativeResult.consignmentCodes, ["CPMULTI001"]);
  assert.equal(shipmentCounter, 1);

  // Case 2: CP rejects multi-item create with 400 -> automatically books separate consignments per box
  const createRequests: any[] = [];
  let boxSeq = 0;
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input);
    if (url.endsWith("/v2/domestic/quote")) {
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [{ RateCardCode: "ITMR", CalculatedFreightCharge: "16.00" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.endsWith("/v2/domestic/shipment/create")) {
      const payload = JSON.parse(String(init?.body || "{}"));
      createRequests.push(payload);
      if (payload.items.length > 1 || payload.items[0].quantity > 1) {
        return new Response(
          JSON.stringify({ responseCode: "FAILED", msg: "Item rate allows maximum 1 parcel per consignment" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      boxSeq++;
      return new Response(
        JSON.stringify({ responseCode: "SUCCESS", data: { consignmentCode: `CPSEP-${boxSeq}` } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const sepResult = await createCouriersPleaseDispatch({
    orderId: "ord-sep-2",
    recipient: { name: "Bob Buyer", line1: "5 Queen St", suburb: "Melbourne", state: "VIC", postcode: "3000" },
    items: [
      { quantity: 2, length: 40, width: 30, height: 20, weight: 6, description: "Side Lamp" },
      { quantity: 1, length: 50, width: 35, height: 25, weight: 9, description: "Mirror" },
    ],
  });
  assert.equal(sepResult.bookingMode, "SEPARATE_CONSIGNMENTS");
  assert.deepEqual(sepResult.consignmentCodes, ["CPSEP-1", "CPSEP-2", "CPSEP-3"]);
  assert.equal(sepResult.consignmentCode, "CPSEP-1, CPSEP-2, CPSEP-3");
  assert.equal(createRequests.length, 4); // 1 failed multi-parcel + 3 single-box consignments

  // Case 3: Partial failure on Box 2 preserves created Box 1 consignment on CouriersPleasePartialBookingError
  let partialBox = 0;
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input);
    if (url.endsWith("/v2/domestic/quote")) {
      return new Response(
        JSON.stringify({ responseCode: "SUCCESS", data: [{ RateCardCode: "ITMR", CalculatedFreightCharge: "16.00" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.endsWith("/v2/domestic/shipment/create")) {
      const payload = JSON.parse(String(init?.body || "{}"));
      if (payload.items.length > 1) {
        return new Response(JSON.stringify({ responseCode: "FAILED", msg: "Single parcel only" }), { status: 400 });
      }
      partialBox++;
      if (partialBox === 1) {
        return new Response(
          JSON.stringify({ responseCode: "SUCCESS", data: { consignmentCode: "CPPART-1" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new TypeError("socket hang up");
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  await assert.rejects(
    () =>
      createCouriersPleaseDispatch({
        orderId: "ord-partial-3",
        recipient: { name: "Bob Buyer", line1: "5 Queen St", suburb: "Melbourne", state: "VIC", postcode: "3000" },
        items: [
          { quantity: 1, length: 40, width: 30, height: 20, weight: 6, description: "Box 1" },
          { quantity: 1, length: 45, width: 35, height: 22, weight: 8, description: "Box 2" },
        ],
      }),
    (err: unknown) => {
      assert.ok(err instanceof CouriersPleasePartialBookingError);
      assert.equal(err.partialConsignments.length, 1);
      assert.equal(err.partialConsignments[0].consignmentCode, "CPPART-1");
      return true;
    }
  );
});

test("bookCouriersPleasePickup and getCouriersPleaseTracking handle multiple separate consignment codes safely", async (t) => {
  const prevEnv = {
    COURIER_PLEASE_TEST_MODE: process.env.COURIER_PLEASE_TEST_MODE,
    COURIER_PLEASE_API_ID: process.env.COURIER_PLEASE_API_ID,
    COURIER_PLEASE_API_KEY: process.env.COURIER_PLEASE_API_KEY,
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
  process.env.COURIER_PLEASE_API_ID = "test-api-id";
  process.env.COURIER_PLEASE_API_KEY = "test-api-key";

  const pickupPayloads: any[] = [];
  let locateCall = 0;
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input);
    if (url.endsWith("/v2/domestic/bookPickup")) {
      const body = JSON.parse(String(init?.body || "{}"));
      pickupPayloads.push(body);
      return new Response(
        JSON.stringify({ responseCode: "SUCCESS", data: { jobNumber: `JOB-${pickupPayloads.length}` } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes("/v1/domestic/locateParcel")) {
      locateCall++;
      const isBox1 = url.includes("CP1");
      // Round 1: CP1 Delivered, CP2 In Transit -> overall must NOT be delivered
      // Round 2 (locateCall > 2): both Delivered
      const delivered = isBox1 || locateCall > 2;
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: {
            consignmentInfo: [
              {
                consignmentCode: isBox1 ? "CP1" : "CP2",
                status: delivered ? "Delivered 1 of 1" : "In Transit",
                deliveredAt: delivered ? "2026-11-12 10:00:00" : "",
                itemsCoupons: [
                  { trackingInfo: [{ date: "2026-11-12", time: "10:00:00", action: delivered ? "Goods Delivered" : "Sorted at depot" }] },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const { bookCouriersPleasePickup, getCouriersPleaseTracking } = await import("../lib/couriersplease");
  const pickup = await bookCouriersPleasePickup({
    consignmentCode: "CP1, CP2",
    consignmentCodes: ["CP1", "CP2"],
    perConsignmentWeights: [8, 12],
    totalItemCount: 2,
    totalWeight: 20,
    readyDateTime: "2026-11-12 10:00 AM",
  });

  assert.equal(pickupPayloads.length, 2);
  assert.equal(pickupPayloads[0].consignmentCode, "CP1");
  assert.equal(pickupPayloads[0].totalWeight, 8);
  assert.equal(pickupPayloads[1].consignmentCode, "CP2");
  assert.equal(pickupPayloads[1].totalWeight, 12);
  assert.equal(pickup.jobNumber, "JOB-1, JOB-2");

  const partialTracking = await getCouriersPleaseTracking("CP1, CP2");
  assert.ok(partialTracking);
  assert.equal(partialTracking.isDelivered, false);
  assert.equal(partialTracking.normalizedStatus, "OUT_FOR_DELIVERY");

  const fullTracking = await getCouriersPleaseTracking("CP1, CP2");
  assert.ok(fullTracking);
  assert.equal(fullTracking.isDelivered, true);
  assert.equal(fullTracking.normalizedStatus, "DELIVERED");
});
