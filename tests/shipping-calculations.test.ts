import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);

test("packageItemsForCouriersPlease preserves valid single boxes up to 25kg / 40kg cubic / 180cm without fake splitting or truncation", async () => {
  const { packageItemsForCouriersPlease } = await import("../lib/couriersplease");

  // 24.8kg dead weight, 175cm length, 38.5kg cubic (175*44*20/4000 = 38.5) — all within CP limits -> 1 box
  const heavyValid = packageItemsForCouriersPlease([
    { count: 2, lengthCm: 175, widthCm: 44, heightCm: 20, weightKg: 24.8 },
  ]);
  assert.equal(heavyValid.length, 1);
  assert.deepEqual(heavyValid[0], {
    quantity: 2,
    length: 175,
    width: 44,
    height: 20,
    physicalWeight: 24.8,
  });

  // Unsorted dimensions (40 x 140 x 20) must sort descending to 140 x 40 x 20 and NEVER clamp 140 to 100
  const unsorted = packageItemsForCouriersPlease([
    { count: 1, lengthCm: 40, widthCm: 140, heightCm: 20, weightKg: 14.5 },
  ]);
  assert.equal(unsorted.length, 1);
  assert.deepEqual(unsorted[0], {
    quantity: 1,
    length: 140,
    width: 40,
    height: 20,
    physicalWeight: 14.5,
  });

  // Fractional dimensions round UP to whole carrier cm, while exact integers and 2dp weights stay exact
  const fractional = packageItemsForCouriersPlease([
    { count: 1, lengthCm: 24.2, widthCm: 18.0, heightCm: 3.1, weightKg: 0.1 + 0.2 },
    { count: 1, lengthCm: 30, widthCm: 20, heightCm: 10, weightKg: 2.341 },
  ]);
  assert.equal(fractional.length, 2);
  assert.deepEqual(fractional[0], {
    quantity: 1,
    length: 25,
    width: 18,
    height: 4,
    physicalWeight: 0.3,
  });
  assert.deepEqual(fractional[1], {
    quantity: 1,
    length: 30,
    width: 20,
    height: 10,
    physicalWeight: 2.35,
  });

  // Manual oversized override (>25kg dead / >40kg cubic / >180cm length) splits cleanly within CP bounds
  const oversized = packageItemsForCouriersPlease([
    { count: 1, lengthCm: 220, widthCm: 50, heightCm: 30, weightKg: 28 },
  ]);
  assert.ok(oversized.length > 1);
  let totalWeight = 0;
  let totalVolume = 0;
  for (const box of oversized) {
    assert.ok(box.length <= 180);
    assert.ok(box.physicalWeight <= 25);
    assert.ok((box.length * box.width * box.height) / 4000 <= 40);
    totalWeight += box.physicalWeight * box.quantity;
    totalVolume += box.length * box.width * box.height * box.quantity;
  }
  assert.equal(Math.round(totalWeight * 100) / 100, 28);
  assert.ok(totalVolume >= 220 * 50 * 30);
});

test("isLargeProduct enforces Couriers Please 40kg cubic limit alongside 25kg dead weight and 180cm length", async () => {
  const { isLargeProduct } = await import("../lib/manual-delivery");

  // Exact boundary 40.0kg cubic (100*40*40/4000 = 40), 25kg dead, 180cm max dim -> standard CP eligible
  assert.equal(
    isLargeProduct({
      name: "Storage Bench",
      weight: 25,
      length: 100,
      width: 40,
      height: 40,
    }),
    false
  );
  assert.equal(
    isLargeProduct({
      name: "Curtain Rod",
      weight: 4,
      length: 180,
      width: 10,
      height: 10,
    }),
    false
  );

  // Light physical weight (12kg) but 60kg cubic ((100*80*30)/4000 = 60 > 40) -> must route as Large/Manual
  assert.equal(
    isLargeProduct({
      name: "Lightweight Beanbag Carton",
      weight: 12,
      length: 100,
      width: 80,
      height: 30,
    }),
    true
  );
});

test("getCouriersPleaseRates handles surcharges cleanly, deduplicates rotated identical boxes, and sums disjoint weight tiers", async (t) => {
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

  // Scenario A: Freight + Fuel + Insurance + GST sums cleanly in integer cents
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        responseCode: "SUCCESS",
        data: [
          {
            RateCardCode: "TSKG",
            RateCardDescription: "Road Express",
            CalculatedFreightCharge: "18.10",
            CalculatedFuelCharge: "2.35",
            InsuranceAmt: "0.95",
            CalculatedGST: "2.14",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch;

  const { getCouriersPleaseRates } = await import("../lib/couriersplease");
  const surchargeRates = await getCouriersPleaseRates(
    { suburb: "Melbourne", state: "VIC", postcode: "3000" },
    [{ count: 1, lengthCm: 35, widthCm: 25, heightCm: 15, weightKg: 4 }]
  );
  assert.equal(surchargeRates.length, 1);
  assert.equal(surchargeRates[0].price, 23.54);

  // Scenario B: Multi-box order with rotated identical boxes + a heavy box on disjoint weight tiers (TS5 + TSKG)
  const seenPayloads: any[] = [];
  globalThis.fetch = (async (_url: any, init: any) => {
    const payload = JSON.parse(String(init?.body || "{}"));
    seenPayloads.push(payload);
    const totalQty = payload.items.reduce((sum: number, it: any) => sum + Number(it.quantity), 0);
    if (totalQty > 1) {
      return new Response(
        JSON.stringify({ responseCode: "FAILED", msg: "Single item only" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const weight = payload.items[0].physicalWeight;
    if (weight <= 5) {
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [{ RateCardCode: "TS5", RateCardDescription: "5kg Tier", CalculatedFreightCharge: "11.50" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        responseCode: "SUCCESS",
        data: [{ RateCardCode: "TSKG", RateCardDescription: "Per Kg Tier", CalculatedFreightCharge: "24.50" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  const mixedRates = await getCouriersPleaseRates(
    { suburb: "Sydney", state: "NSW", postcode: "2000" },
    [
      { count: 1, lengthCm: 30, widthCm: 20, heightCm: 15, weightKg: 3 },
      { count: 1, lengthCm: 20, widthCm: 30, heightCm: 15, weightKg: 3 },
      { count: 1, lengthCm: 80, widthCm: 40, heightCm: 30, weightKg: 14 },
    ]
  );

  // 1 initial multi-parcel attempt + 2 consolidated unique individual box quotes (NOT 3!)
  assert.equal(seenPayloads.length, 3);
  assert.equal(seenPayloads[0].items.length, 2);
  assert.equal(mixedRates.length, 1);
  // 2 * 11.50 (rotated pair) + 1 * 24.50 = 47.50
  assert.equal(mixedRates[0].price, 47.5);
});

test("/api/cart/products exposes server-computed isLargeItem for variant & extraPackages cubic weights", async () => {
  const prodId = "cm00000000000000000000101";
  const varSmallId = "cm00000000000000000000201";
  const varCubicLargeId = "cm00000000000000000000202";

  const mockProducts = [
    {
      id: prodId,
      name: "Convertible Ottoman",
      description: "Modular home seating",
      slug: "convertible-ottoman",
      sku: "OTT-BASE",
      images: ["/img.jpg"],
      hasVariants: true,
      isLargeItem: false,
      basePrice: 1400,
      memberPrice: null,
      stock: 10,
      weight: 8,
      length: 50,
      width: 40,
      height: 20,
      extraPackages: [],
      category: { slug: "living", name: "Living" },
      productVariants: [
        {
          id: varSmallId,
          sku: "OTT-SM",
          price: 1400,
          memberPrice: null,
          stock: 5,
          weight: 8,
          length: 50,
          width: 40,
          height: 20,
          extraPackages: [],
          images: [],
          values: [{ variantValue: { value: "Compact", variantAttribute: { name: "Size" } } }],
        },
        {
          id: varCubicLargeId,
          sku: "OTT-LG",
          price: 1500,
          memberPrice: null,
          stock: 5,
          weight: 10,
          length: 50,
          width: 40,
          height: 20,
          // Box 2 has cubic weight = (120 * 70 * 25) / 4000 = 52.5kg > 40kg!
          extraPackages: [{ weight: 14, length: 120, width: 70, height: 25 }],
          images: [],
          values: [{ variantValue: { value: "Jumbo", variantAttribute: { name: "Size" } } }],
        },
      ],
    },
  ];

  require.cache[require.resolve("../lib/db")] = {
    exports: {
      db: {
        product: {
          findMany: async () => mockProducts,
        },
      },
    },
  } as NodeModule;
  require.cache[require.resolve("../lib/redis")] = {
    exports: {
      cacheGet: async () => null,
      cacheSet: async () => {},
    },
  } as NodeModule;
  delete require.cache[require.resolve("../app/api/cart/products/route")];

  const { POST } = require("../app/api/cart/products/route") as typeof import("../app/api/cart/products/route");
  const req = new NextRequest("https://shop.example/api/cart/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: [prodId] }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.prices[varSmallId].isLargeItem, false);
  assert.equal(data.prices[varCubicLargeId].isLargeItem, true);
  assert.equal(data.catalog[varCubicLargeId].isLargeItem, true);
});

test("getCouriersPleaseRates falls back cleanly on HTTP 200 FAILED and beats inflated overlapping rate cards", async (t) => {
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

  globalThis.fetch = (async (_url: any, init: any) => {
    const payload = JSON.parse(String(init?.body || "{}"));
    const totalQty = payload.items.reduce((sum: number, it: any) => sum + Number(it.quantity), 0);
    // Simulate Couriers Please returning HTTP 200 with responseCode: FAILED for multi-item quote
    if (totalQty > 1) {
      return new Response(
        JSON.stringify({ responseCode: "FAILED", msg: "Single parcel rate only" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const weight = payload.items[0].physicalWeight;
    if (weight <= 5) {
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [
            { RateCardCode: "TS5", RateCardDescription: "5kg Parcel", CalculatedFreightCharge: "11.50" },
            { RateCardCode: "EXPRESS", RateCardDescription: "Priority", CalculatedFreightCharge: "25.00" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        responseCode: "SUCCESS",
        data: [
          { RateCardCode: "TSKG", RateCardDescription: "Heavy Road", CalculatedFreightCharge: "24.50" },
          { RateCardCode: "EXPRESS", RateCardDescription: "Priority", CalculatedFreightCharge: "40.00" },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  const { getCouriersPleaseRates } = await import("../lib/couriersplease");
  const rates = await getCouriersPleaseRates(
    { suburb: "Sydney", state: "NSW", postcode: "2000" },
    [
      { count: 2, lengthCm: 30, widthCm: 20, heightCm: 15, weightKg: 3 },
      { count: 1, lengthCm: 80, widthCm: 40, heightCm: 30, weightKg: 14 },
    ]
  );

  // Optimal separate sum (2*11.50 + 24.50 = 47.50) must rank above overlapping EXPRESS (2*25 + 40 = 90)
  assert.ok(rates.length >= 2);
  assert.equal(rates[0].price, 47.5);
});

test("Checkout shipping quote and session calculate multi-item + multi-packaging orders accurately up to >$500 shipping", async (t) => {
  const prevSecret = process.env.AUTH_SECRET;
  const prevGateway = process.env.PAYMENT_GATEWAY;
  const prevCpId = process.env.COURIER_PLEASE_API_ID;
  const prevCpKey = process.env.COURIER_PLEASE_API_KEY;
  const prevMode = process.env.ONLINEPAY_MODE;
  const prevReturn = process.env.ONLINEPAY_RETURN_BASE_URL;
  const prevUid = process.env.ONLINEPAY_USER_UID;
  const prevOpKey = process.env.ONLINEPAY_API_KEY;
  const prevEntity = process.env.ONLINEPAY_ENTITY_ID;
  const prevPpc = process.env.ONLINEPAY_PPC_ID;
  const prev3ds = process.env.ONLINEPAY_3DS_ID;
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
    const restore = (k: string, v: string | undefined) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    };
    restore("AUTH_SECRET", prevSecret);
    restore("PAYMENT_GATEWAY", prevGateway);
    restore("COURIER_PLEASE_API_ID", prevCpId);
    restore("COURIER_PLEASE_API_KEY", prevCpKey);
    restore("ONLINEPAY_MODE", prevMode);
    restore("ONLINEPAY_RETURN_BASE_URL", prevReturn);
    restore("ONLINEPAY_USER_UID", prevUid);
    restore("ONLINEPAY_API_KEY", prevOpKey);
    restore("ONLINEPAY_ENTITY_ID", prevEntity);
    restore("ONLINEPAY_PPC_ID", prevPpc);
    restore("ONLINEPAY_3DS_ID", prev3ds);
  });

  process.env.AUTH_SECRET = "shipping-calc-e2e-secret";
  process.env.PAYMENT_GATEWAY = "onlinepay";
  process.env.COURIER_PLEASE_API_ID = "test-id";
  process.env.COURIER_PLEASE_API_KEY = "test-key";
  process.env.ONLINEPAY_MODE = "test";
  process.env.ONLINEPAY_RETURN_BASE_URL = "https://shop.example";
  process.env.ONLINEPAY_USER_UID = "test";
  process.env.ONLINEPAY_API_KEY = "test";
  process.env.ONLINEPAY_ENTITY_ID = "test";
  process.env.ONLINEPAY_PPC_ID = "test";
  process.env.ONLINEPAY_3DS_ID = "test";

  const prodA = "cm00000000000000000000301";
  const prodB = "cm00000000000000000000302";
  const varB = "cm00000000000000000000402";
  let createdOrder: any = null;
  let capturedGroups: any[] = [];

  const mockProducts = [
    {
      id: prodA,
      name: "Sideboard Cabinet",
      description: "Two-box flat pack cabinet",
      isLargeItem: false,
      categoryId: "cat-1",
      category: { slug: "cabinets", name: "Cabinets" },
      basePrice: 120,
      memberPrice: null,
      stock: 5,
      weight: 4,
      length: 40,
      width: 30,
      height: 20,
      extraPackages: [{ weight: 9, length: 65, width: 40, height: 25 }],
      productVariants: [],
    },
    {
      id: prodB,
      name: "Coffee Table",
      description: "Multi-package table variant",
      isLargeItem: false,
      categoryId: "cat-1",
      category: { slug: "tables", name: "Tables" },
      basePrice: 150,
      memberPrice: null,
      stock: 4,
      weight: null,
      length: null,
      width: null,
      height: null,
      extraPackages: [],
      productVariants: [
        {
          id: varB,
          price: 150,
          memberPrice: null,
          stock: 3,
          weight: 6,
          length: 50,
          width: 35,
          height: 20,
          extraPackages: [{ weight: 11, length: 75, width: 45, height: 25 }],
          values: [{ variantValue: { value: "Oak", variantAttribute: { name: "Finish" } } }],
        },
      ],
    },
  ];

  const stubDb = {
    user: { findUnique: async () => null },
    membershipPlan: { findFirst: async () => null },
    coupon: { findUnique: async () => null },
    orderItem: { aggregate: async () => ({ _sum: { quantity: 0 } }) },
    product: {
      findMany: async () => mockProducts,
      findUnique: async ({ where }: any) => {
        const found = mockProducts.find((p) => p.id === where.id);
        return found ? { stock: found.stock, isActive: true } : null;
      },
    },
    productVariant: {
      findUnique: async ({ where }: any) => {
        for (const p of mockProducts) {
          const v = p.productVariants.find((pv) => pv.id === where.id);
          if (v) return { productId: p.id, stock: v.stock, isActive: true };
        }
        return null;
      },
    },
    order: {
      findUnique: async () => createdOrder,
      create: async ({ data }: any) => {
        createdOrder = {
          ...data,
          id: "cm00000000000000000000999",
          address: data.address.create,
          items: data.items.create,
          user: null,
          userId: null,
          guestPhone: data.guestPhone,
        };
        return createdOrder;
      },
      update: async ({ data }: any) => {
        Object.assign(createdOrder, data);
        return createdOrder;
      },
    },
    $queryRaw: async () => [],
    $transaction: async (fn: any) => fn(stubDb),
  };

  require.cache[require.resolve("../lib/db")] = { exports: { db: stubDb } } as NodeModule;
  require.cache[require.resolve("../auth")] = { exports: { auth: async () => null } } as NodeModule;
  require.cache[require.resolve("../lib/rate-limit")] = {
    exports: {
      consumeRateLimit: async () => ({ allowed: true, remaining: 10, retryAfter: 60 }),
      getClientIp: () => "127.0.0.1",
      rateLimitResponse: () => Response.json({ error: "rate limited" }, { status: 429 }),
    },
  } as NodeModule;
  require.cache[require.resolve("../lib/brevo")] = {
    exports: { sendOrderConfirmationEmail: async () => {} },
  } as NodeModule;
  require.cache[require.resolve("../lib/twilio")] = {
    exports: { sendOrderConfirmationSms: async () => {}, sendOrderWhatsApp: async () => {} },
  } as NodeModule;
  require.cache[require.resolve("next/server")] = {
    exports: { ...require("next/server"), after: () => {} },
  } as NodeModule;

  const realShippingQuote = require("../lib/shipping-quote");
  require.cache[require.resolve("../lib/shipping-quote")] = { exports: realShippingQuote } as NodeModule;
  require.cache[require.resolve("../lib/couriersplease")] = {
    exports: {
      checkCouriersPleaseAvailability: () => ({ available: true, reason: null }),
      getCouriersPleaseRates: async (_addr: any, groups: any[]) => {
        capturedGroups = groups;
        // Return $90 per physical box -> 6 * 90 = $540 (> $500 old cap!)
        const boxCount = groups.reduce((s, g) => s + Number(g.count), 0);
        return [{ serviceCode: "TSKG", serviceName: "Road Express", price: boxCount * 90 }];
      },
    },
  } as NodeModule;

  delete require.cache[require.resolve("../app/api/shipping/couriersplease/route")];
  delete require.cache[require.resolve("../app/api/checkout/session/route")];
  const quoteRoute = require("../app/api/shipping/couriersplease/route") as typeof import("../app/api/shipping/couriersplease/route");
  const checkoutRoute = require("../app/api/checkout/session/route") as typeof import("../app/api/checkout/session/route");

  const address = {
    name: "Multi Box Buyer",
    phone: "0412345678",
    line1: "100 Pitt St",
    suburb: "Sydney",
    state: "NSW" as const,
    postcode: "2000",
    country: "AU" as const,
  };
  const cartItems = [
    { productId: prodA, quantity: 2 },
    { productId: prodB, variantId: varB, quantity: 1 },
  ];

  // 1. Quote route computes 6 boxes: (2 * 2 boxes for ProdA) + (1 * 2 boxes for ProdB variant)
  const quoteRes = await quoteRoute.POST(
    new NextRequest("https://shop.example/api/shipping/couriersplease", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, items: cartItems }),
    })
  );
  assert.equal(quoteRes.status, 200);
  const quoteJson = await quoteRes.json();
  assert.equal(quoteJson.hasLargeItems, false);
  assert.equal(capturedGroups.reduce((s, g) => s + g.count, 0), 6);
  assert.equal(quoteJson.rates[0].price, 540);
  assert.ok(quoteJson.rates[0].quoteToken);

  // 2. Duplicate SKU rows exceeding stock (2 + 2 = 4 > varB stock 3) must be rejected cleanly
  const overStockRes = await checkoutRoute.POST(
    new NextRequest("https://shop.example/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          { productId: prodB, variantId: varB, quantity: 2 },
          { productId: prodB, variantId: varB, quantity: 2 },
        ],
        address,
        guestEmail: "buyer@example.com",
        fulfillmentType: "DELIVERY",
        shippingRateCode: quoteJson.rates[0].serviceCode,
        shippingCost: quoteJson.rates[0].price,
        shippingQuoteToken: quoteJson.rates[0].quoteToken,
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      }),
    })
  );
  assert.equal(overStockRes.status, 400);

  // 3. Valid multi-item + multi-packaging checkout creates order with $540 shipping and all 4 packedBox entries (6 boxes total)
  globalThis.fetch = (async () =>
    Response.json({ id: "op-multi-1", url: "https://provider.example/checkout" })) as typeof fetch;

  const checkoutRes = await checkoutRoute.POST(
    new NextRequest("https://shop.example/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: cartItems,
        address,
        guestEmail: "buyer@example.com",
        fulfillmentType: "DELIVERY",
        shippingRateCode: quoteJson.rates[0].serviceCode,
        shippingCost: quoteJson.rates[0].price,
        shippingQuoteToken: quoteJson.rates[0].quoteToken,
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      }),
    })
  );
  assert.equal(checkoutRes.status, 200);
  assert.equal(createdOrder?.shippingCost, 540);
  assert.equal(createdOrder?.subtotal, 390); // 2*120 + 1*150
  assert.equal(createdOrder?.total, 930); // 390 + 540
  assert.equal(createdOrder?.packedBoxes?.length, 4);
  assert.equal(
    createdOrder?.packedBoxes?.reduce((s: number, b: any) => s + b.quantity, 0),
    6
  );
});

test("Multi-box product (Box 1 + Box 2) quotes each physical parcel independently and never collapses to single-box price", async (t) => {
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

  // Simulate real CouriersPlease API response:
  // - Multi-item probe returns $14.99 (L11 minimum consignment charge)
  // - Box 1 (70x40x20, 1kg) returns $14.99 (L11)
  // - Box 2 (35x20x10, 0.5kg) returns $11.96 (TS3)
  globalThis.fetch = (async (_url: any, init: any) => {
    const payload = JSON.parse(String(init?.body || "{}"));
    const totalQty = payload.items.reduce((sum: number, it: any) => sum + Number(it.quantity), 0);
    if (totalQty > 1 || payload.items.length > 1) {
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [
            {
              RateCardCode: "L11",
              RateCardDescription: "Road Express",
              CalculatedFreightCharge: "12.53",
              CalculatedFuelCharge: "2.46",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const item = payload.items[0];
    if (item.length === 70 && item.width === 40 && item.height === 20) {
      // Box 1
      return new Response(
        JSON.stringify({
          responseCode: "SUCCESS",
          data: [
            {
              RateCardCode: "L11",
              RateCardDescription: "Road Express",
              CalculatedFreightCharge: "12.53",
              CalculatedFuelCharge: "2.46",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Box 2
    return new Response(
      JSON.stringify({
        responseCode: "SUCCESS",
        data: [
          {
            RateCardCode: "TS3",
            RateCardDescription: "3Kg Parcel",
            CalculatedFreightCharge: "10.00",
            CalculatedFuelCharge: "1.96",
          },
          {
            RateCardCode: "L11",
            RateCardDescription: "Road Express",
            CalculatedFreightCharge: "12.53",
            CalculatedFuelCharge: "2.46",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  const { getCouriersPleaseRates } = await import("../lib/couriersplease");

  // Single Box 1 alone
  const singleRates = await getCouriersPleaseRates(
    { suburb: "Golden Grove", state: "SA", postcode: "5125" },
    [{ count: 1, lengthCm: 70, widthCm: 40, heightCm: 20, weightKg: 1 }]
  );
  assert.equal(singleRates.length, 1);
  assert.equal(singleRates[0].price, 14.99);

  // Box 1 + Box 2 (the user's exact 2-box product)
  const twoBoxRates = await getCouriersPleaseRates(
    { suburb: "Golden Grove", state: "SA", postcode: "5125" },
    [
      { count: 1, lengthCm: 70, widthCm: 40, heightCm: 20, weightKg: 1 },
      { count: 1, lengthCm: 35, widthCm: 20, heightCm: 10, weightKg: 0.5 },
    ]
  );

  // Must NOT collapse to $14.99; must sum Box 1 ($14.99) + Box 2 ($11.96) = $26.95
  assert.ok(twoBoxRates.length > 0);
  assert.equal(twoBoxRates[0].price, 26.95);
  assert.ok(twoBoxRates[0].price > singleRates[0].price);
});
