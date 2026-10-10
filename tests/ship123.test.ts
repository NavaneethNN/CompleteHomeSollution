import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { calculateShip123Rate, getEligibleShip123Products, getShip123Rates, ship123LabelUrl, ship123SenderFromEnv } from "../lib/ship123";
import { resetShippingFxCacheForTests } from "../lib/shipping-fx";

const address = { name: "Test Buyer", line1: "1 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000" };
const groups = [{ count: 2, lengthCm: 20, widthCm: 15, heightCm: 10, weightKg: 1 }];

test("Ship123 accepts the sender street key used in local configuration", t => {
  const keys = ["SHIP123_SENDER_NAME", "SHIP123_SENDER_LINE1", "SHIP123_SENDER_STREET", "SHIP123_SENDER_SUBURB", "SHIP123_SENDER_STATE", "SHIP123_SENDER_POSTCODE", "SHIP123_SENDER_PHONE"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  process.env.SHIP123_SENDER_NAME = "Test Sender";
  delete process.env.SHIP123_SENDER_LINE1;
  process.env.SHIP123_SENDER_STREET = "1 Example Street";
  process.env.SHIP123_SENDER_SUBURB = "Melbourne";
  process.env.SHIP123_SENDER_STATE = "VIC";
  process.env.SHIP123_SENDER_POSTCODE = "3000";
  process.env.SHIP123_SENDER_PHONE = "0400000000";
  assert.equal(ship123SenderFromEnv().line1, "1 Example Street");
});

function apiKey(t: TestContext) {
  const sender = { SHIP123_SENDER_NAME: "Test Sender", SHIP123_SENDER_LINE1: "18 Edison Drive", SHIP123_SENDER_SUBURB: "Golden Grove", SHIP123_SENDER_STATE: "SA", SHIP123_SENDER_POSTCODE: "5125", SHIP123_SENDER_PHONE: "0400000000" };
  for (const [key, value] of Object.entries(sender)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const previous = process.env.SHIP_123_API_KEY;
  process.env.SHIP_123_API_KEY = "test-secret";
  t.after(() => { if (previous === undefined) delete process.env.SHIP_123_API_KEY; else process.env.SHIP_123_API_KEY = previous; });
}

test("Ship123 allows named Australia Post products through Ship123 but excludes ambiguous automatic products", async t => {
  apiKey(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, data: [
    { productCode: "AU_POST_STANDARD", productName: "Standard", customCarrier: "AUSTRALIA POST" },
    { productCode: "AUTO_LOWEST_PRICE", productName: "Cheapest", customCarrier: "OTHER" },
    { productCode: "ECONOMY_OTHER", productName: "Unknown courier", customCarrier: "OTHER" },
    { productCode: "DHL_EXPRESS", productName: "DHL Express", customCarrier: "DHL" },
  ] }));
  assert.deepEqual(await getEligibleShip123Products(), [
    { code: "AU_POST_STANDARD", name: "Standard", carrier: "AUSTRALIA POST" },
    { code: "DHL_EXPRESS", name: "DHL Express", carrier: "DHL" },
  ]);
});

test("Ship123 quotes use real parcel quantities and current ECB USD-to-AUD conversion", async t => {
  apiKey(t); resetShippingFxCacheForTests();
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("product/list")) return Response.json({ success: true, data: [
      { productCode: "DHL_EXPRESS", productName: "DHL Express", customCarrier: "DHL" },
    ] });
    if (url.includes("order/calculate")) {
      assert.equal((init?.headers as Record<string, string>)["Api-Secret"], "test-secret");
      const body = JSON.parse(init?.body as string);
      assert.equal(body.productCode, "DHL_EXPRESS");
      assert.equal(body.shipTo.cityName, "Sydney");
      assert.equal(body.shipTo.postalCode, "2000");
      assert.equal(body.shipFrom.cityName, "Golden Grove");
      assert.equal(body.shipFrom.postalCode, "5125");
      assert.equal(body.shipFrom.countryRegionCode, "AU");
      assert.equal(body.bsFlag, 0);
      assert.equal(body.packageList[0].quantity, 2);
      return Response.json({ success: true, data: { productCode: "DHL_EXPRESS", productName: "DHL Express", totalPrice: 10, currencyCode: "USD" } });
    }
    assert.match(url, /data-api\.ecb\.europa\.eu/);
    const today = new Date().toISOString().slice(0, 10);
    return new Response(`CURRENCY,TIME_PERIOD,OBS_VALUE\nAUD,${today},1.60\nUSD,${today},1.00\n`);
  });
  const rates = await getShip123Rates(address, groups);
  assert.deepEqual(rates, [{ serviceCode: "DHL_EXPRESS", serviceName: "DHL Express", price: 16, deliveryTime: null }]);
});

test("documented product responses work without customCarrier and display readable service names", async t => {
  apiKey(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, data: [
    { productCode: "AU_POST_EPARCEL", productName: "AU_POST_EPARCEL" },
    { productCode: "AU_POST_EXPRESS", productName: "AU_POST_EXPRESS" },
    { productCode: "AUTO_LOWEST_PRICE", productName: "Automatic" },
  ] }));
  assert.deepEqual(await getEligibleShip123Products(), [
    { code: "AU_POST_EPARCEL", name: "Australia Post eParcel", carrier: "AUSTRALIA POST" },
    { code: "AU_POST_EXPRESS", name: "Australia Post Express", carrier: "AUSTRALIA POST" },
  ]);
});

test("quotes fail clearly before contacting the provider when sender configuration is missing", async t => {
  apiKey(t);
  delete process.env.SHIP123_SENDER_POSTCODE;
  t.mock.method(globalThis, "fetch", async () => { assert.fail("Must not request a quote without its origin"); });
  await assert.rejects(getShip123Rates(address, groups), /sender address is not configured/);
});

test("changing destination sends a fresh quote request with the same configured origin", async t => {
  apiKey(t);
  const postcodes: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    assert.match(url, /order\/calculate$/);
    assert.equal(init?.cache, "no-store");
    const body = JSON.parse(init?.body as string);
    postcodes.push(body.shipTo.postalCode);
    assert.equal(body.shipFrom.postalCode, "5125");
    return Response.json({ success: true, data: { productCode: body.productCode, totalPrice: body.shipTo.postalCode === "5000" ? 10 : 20, currencyCode: "AUD" } });
  });
  const nearby = await calculateShip123Rate("AU_POST_STANDARD", { ...address, suburb: "Adelaide", state: "SA", postcode: "5000" }, groups);
  const distant = await calculateShip123Rate("AU_POST_STANDARD", { ...address, suburb: "Perth", state: "WA", postcode: "6000" }, groups);
  assert.deepEqual(postcodes, ["5000", "6000"]);
  assert.equal(nearby.amount, 10);
  assert.equal(distant.amount, 20);
});

test("Ship123 quotes the named Australia Post service when it is the only available carrier", async t => {
  apiKey(t); resetShippingFxCacheForTests();
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("product/list")) return Response.json({ success: true, data: [
      { productCode: "AU_POST_STANDARD", customCarrier: "AUSTRALIA POST" },
      { productCode: "AUTO_LOWEST_PRICE", customCarrier: "OTHER" },
    ] });
    if (url.includes("order/calculate")) {
      assert.equal(JSON.parse(init?.body as string).productCode, "AU_POST_STANDARD");
      return Response.json({ success: true, data: { productCode: "AU_POST_STANDARD", totalPrice: 10, currencyCode: "AUD" } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  assert.deepEqual(await getShip123Rates(address, groups), [
    { serviceCode: "AU_POST_STANDARD", serviceName: "Australia Post Standard", price: 10, deliveryTime: null },
  ]);
});

test("Ship123 retries a temporarily throttled named service without creating a shipment", async t => {
  apiKey(t);
  let calculateCalls = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url.includes("product/list")) return Response.json({ success: true, data: [
      { productCode: "AU_POST_STANDARD", productName: "Australia Post Standard", customCarrier: "AUSTRALIA POST" },
    ] });
    assert.match(url, /order\/calculate$/);
    calculateCalls++;
    if (calculateCalls === 1) return Response.json({ success: false, code: "1000004", msg: "Try again" });
    return Response.json({ success: true, data: { productCode: "AU_POST_STANDARD", totalPrice: 10, currencyCode: "AUD" } });
  });
  t.mock.method(console, "error", () => {});
  assert.equal((await getShip123Rates(address, groups))[0].price, 10);
  assert.equal(calculateCalls, 2);
});

test("Ship123 refuses to quote when only an ambiguous automatic product is enabled", async t => {
  apiKey(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, data: [
    { productCode: "AUTO_LOWEST_PRICE", customCarrier: "OTHER" },
  ] }));
  await assert.rejects(getShip123Rates(address, groups), /No named shipping services/);
});

test("Ship123 validates quote response and finds package-level label URLs", async t => {
  apiKey(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, data: { productCode: "DHL_EXPRESS", totalPrice: 10, currencyCode: "USD" } }));
  assert.equal((await calculateShip123Rate("DHL_EXPRESS", address, groups)).amount, 10);
  assert.equal(ship123LabelUrl({ packageList: [{ labelFile: { labelUrl: "https://labels.example/one.pdf" } }] }), "https://labels.example/one.pdf");
  assert.equal(ship123LabelUrl({ labelFile: { labelUrl: "javascript:alert(1)" } }), null);
});
