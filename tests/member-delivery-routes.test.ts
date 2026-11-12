import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";
import {
  MEMBER_FREE_DELIVERY_CODE,
  MEMBER_FIXED_DELIVERY_CODE,
} from "../lib/member-delivery";

const require = createRequire(import.meta.url);

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-member-delivery-routes";

function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}

let mockSession: any = null;
let mockDbUser: any = null;
let mockProducts: any[] = [];
let mockManualRate: any = null;
let cpCalledWithGroups: any[] | null = null;
let mockCpRates: any[] = [{ serviceCode: "E33", serviceName: "Standard", price: 24.0 }];

stub("../lib/rate-limit", {
  consumeRateLimit: async () => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 }),
  getClientIp: () => "127.0.0.1",
  rateLimitResponse: () => new Response("Too Many Requests", { status: 429 }),
});

stub("../auth", {
  auth: async () => mockSession,
});

stub("../lib/db", {
  db: {
    product: {
      findMany: async () => mockProducts,
    },
    user: {
      findUnique: async () => mockDbUser,
    },
  },
});

stub("../lib/manual-delivery", {
  isLargeProduct: (p: any) => Boolean(p?.isLargeItem),
  getManualDeliveryPostcodeRate: async () => mockManualRate,
});

stub("../lib/couriersplease", {
  checkCouriersPleaseAvailability: () => ({ available: true }),
  getCouriersPleaseRates: async (_addr: any, groups: any[]) => {
    cpCalledWithGroups = groups;
    return mockCpRates;
  },
  CouriersPleaseError: class CouriersPleaseError extends Error {
    code?: string;
    constructor(msg: string, code?: string) {
      super(msg);
      this.code = code;
    }
  },
});

const shippingRoute = require("../app/api/shipping/couriersplease/route") as typeof import("../app/api/shipping/couriersplease/route");

const validAddress = {
  name: "Test Customer",
  line1: "100 Pitt St",
  suburb: "Sydney",
  state: "NSW",
  postcode: "2000",
  country: "AU",
};

const PROD_FREE = "clh1111111111111111111111";
const PROD_FIXED = "clh2222222222222222222222";
const PROD_STD = "clh3333333333333333333333";

function resetMocks() {
  mockSession = null;
  mockDbUser = null;
  mockProducts = [];
  mockManualRate = null;
  cpCalledWithGroups = null;
  mockCpRates = [{ serviceCode: "E33", serviceName: "Standard", price: 24.0 }];
}

test("Member receives $0 delivery and bypasses bulky postcode restriction on memberFreeDelivery product", async () => {
  resetMocks();
  mockSession = { user: { id: "user_mem_1" } };
  mockDbUser = { isMember: true, membershipExpiry: new Date(Date.now() + 86400000) };
  mockManualRate = { available: false, charge: 0 };
  mockProducts = [
    {
      id: PROD_FREE,
      name: "Luxury Member Free Sofa",
      description: "Large sofa",
      isLargeItem: true,
      memberFreeDelivery: true,
      memberDeliveryCharge: null,
      requiresPackaging: false,
      weight: 45,
      length: 210,
      width: 95,
      height: 85,
      extraPackages: null,
      category: { slug: "sofas", name: "Sofas" },
      productVariants: [],
    },
  ];

  const req = new NextRequest("http://localhost:3000/api/shipping/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: validAddress,
      items: [{ productId: PROD_FREE, quantity: 1 }],
    }),
  });

  const res = await shippingRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.hasLargeItems, false);
  assert.equal(data.rates.length, 1);
  assert.equal(data.rates[0].serviceCode, MEMBER_FREE_DELIVERY_CODE);
  assert.equal(data.rates[0].price, 0);
  assert.ok(typeof data.rates[0].quoteToken === "string" && data.rates[0].quoteToken.length > 10);
  assert.equal(cpCalledWithGroups, null, "CouriersPlease API must not be called when all items are member free delivery");
});

test("Member pays fixed delivery charge * quantity and bypasses bulky restriction on memberDeliveryCharge product", async () => {
  resetMocks();
  mockSession = { user: { id: "user_mem_2" } };
  mockDbUser = { isMember: true, membershipExpiry: new Date(Date.now() + 86400000) };
  mockManualRate = { available: false, charge: 0 };
  mockProducts = [
    {
      id: PROD_FIXED,
      name: "Fixed Delivery Dining Table",
      description: "Large table",
      isLargeItem: true,
      memberFreeDelivery: false,
      memberDeliveryCharge: 12.5,
      requiresPackaging: false,
      weight: 35,
      length: 180,
      width: 90,
      height: 75,
      extraPackages: null,
      category: { slug: "tables", name: "Tables" },
      productVariants: [],
    },
  ];

  const req = new NextRequest("http://localhost:3000/api/shipping/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: validAddress,
      items: [{ productId: PROD_FIXED, quantity: 3 }],
    }),
  });

  const res = await shippingRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.hasLargeItems, false);
  assert.equal(data.rates.length, 1);
  assert.equal(data.rates[0].serviceCode, MEMBER_FIXED_DELIVERY_CODE);
  assert.equal(data.rates[0].price, 37.5);
  assert.equal(cpCalledWithGroups, null);
});

test("Non-member does NOT get free/fixed member delivery perks and still calculates standard courier", async () => {
  resetMocks();
  mockSession = null;
  mockCpRates = [{ serviceCode: "E33", serviceName: "Standard", price: 18.4 }];
  mockProducts = [
    {
      id: PROD_FREE,
      name: "Small Decor Item",
      description: "Compact decor",
      isLargeItem: false,
      memberFreeDelivery: true,
      memberDeliveryCharge: null,
      requiresPackaging: false,
      weight: 2,
      length: 30,
      width: 20,
      height: 15,
      extraPackages: null,
      category: { slug: "decor", name: "Decor" },
      productVariants: [],
    },
  ];

  const req = new NextRequest("http://localhost:3000/api/shipping/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: validAddress,
      items: [{ productId: PROD_FREE, quantity: 1 }],
    }),
  });

  const res = await shippingRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.rates[0].serviceCode, "E33");
  assert.equal(data.rates[0].price, 18.4);
  assert.ok(Array.isArray(cpCalledWithGroups) && cpCalledWithGroups.length === 1);
});

test("Non-member buying bulky memberFreeDelivery product is still blocked from unsupported postcodes", async () => {
  resetMocks();
  mockSession = { user: { id: "user_non_mem" } };
  mockDbUser = { isMember: false, membershipExpiry: null };
  mockManualRate = { available: false, charge: 0 };
  mockProducts = [
    {
      id: PROD_FREE,
      name: "Luxury Member Free Sofa",
      description: "Large sofa",
      isLargeItem: true,
      memberFreeDelivery: true,
      memberDeliveryCharge: null,
      requiresPackaging: false,
      weight: 45,
      length: 210,
      width: 95,
      height: 85,
      extraPackages: null,
      category: { slug: "sofas", name: "Sofas" },
      productVariants: [],
    },
  ];

  const req = new NextRequest("http://localhost:3000/api/shipping/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: validAddress,
      items: [{ productId: PROD_FREE, quantity: 1 }],
    }),
  });

  const res = await shippingRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.hasLargeItems, true);
  assert.equal(data.manualDeliveryAvailable, false);
  assert.equal(data.rates.length, 0);
});

test("Logged-in non-member toggling addMembership during checkout receives member fixed delivery rate", async () => {
  resetMocks();
  mockSession = { user: { id: "user_new_mem" } };
  mockDbUser = { isMember: false, membershipExpiry: null };
  mockProducts = [
    {
      id: PROD_FIXED,
      name: "Member Fixed Table",
      description: "Dining table",
      isLargeItem: true,
      memberFreeDelivery: false,
      memberDeliveryCharge: 15,
      requiresPackaging: false,
      weight: 20,
      length: 120,
      width: 80,
      height: 75,
      extraPackages: null,
      category: { slug: "tables", name: "Tables" },
      productVariants: [],
    },
  ];

  const req = new NextRequest("http://localhost:3000/api/shipping/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: validAddress,
      addMembership: true,
      items: [{ productId: PROD_FIXED, quantity: 1 }],
    }),
  });

  const res = await shippingRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.hasLargeItems, false);
  assert.equal(data.rates[0].serviceCode, MEMBER_FIXED_DELIVERY_CODE);
  assert.equal(data.rates[0].price, 15);
});

test("Mixed cart for member only calculates courier rate on remaining standard items + fixed charges", async () => {
  resetMocks();
  mockSession = { user: { id: "user_mem_mixed" } };
  mockDbUser = { isMember: true, membershipExpiry: new Date(Date.now() + 86400000) };
  mockCpRates = [{ serviceCode: "E33", serviceName: "Standard", price: 24.0 }];
  mockProducts = [
    {
      id: PROD_FREE,
      name: "Member Free Sofa",
      description: "Sofa",
      isLargeItem: true,
      memberFreeDelivery: true,
      memberDeliveryCharge: null,
      requiresPackaging: false,
      weight: 50,
      length: 220,
      width: 90,
      height: 85,
      extraPackages: null,
      category: { slug: "sofas", name: "Sofas" },
      productVariants: [],
    },
    {
      id: PROD_FIXED,
      name: "Member Fixed Lamp",
      description: "Lamp",
      isLargeItem: false,
      memberFreeDelivery: false,
      memberDeliveryCharge: 10,
      requiresPackaging: false,
      weight: 3,
      length: 40,
      width: 30,
      height: 30,
      extraPackages: null,
      category: { slug: "lighting", name: "Lighting" },
      productVariants: [],
    },
    {
      id: PROD_STD,
      name: "Standard Chair",
      description: "Chair",
      isLargeItem: false,
      memberFreeDelivery: false,
      memberDeliveryCharge: null,
      requiresPackaging: false,
      weight: 6,
      length: 50,
      width: 50,
      height: 50,
      extraPackages: null,
      category: { slug: "chairs", name: "Chairs" },
      productVariants: [],
    },
  ];

  const req = new NextRequest("http://localhost:3000/api/shipping/couriersplease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: validAddress,
      items: [
        { productId: PROD_FREE, quantity: 1 },
        { productId: PROD_FIXED, quantity: 2 }, // $10 * 2 = $20 fixed
        { productId: PROD_STD, quantity: 1 }, // $24 courier quote
      ],
    }),
  });

  const res = await shippingRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.hasLargeItems, false);
  // Only PROD_STD should be sent to CouriersPlease (1 parcel group, count 1, 50x50x50, 6kg)
  assert.ok(Array.isArray(cpCalledWithGroups) && cpCalledWithGroups.length === 1);
  assert.equal(cpCalledWithGroups[0].count, 1);
  assert.equal(cpCalledWithGroups[0].weightKg, 6);
  // Total = 24.00 (CP) + 20.00 (2 * $10 fixed) = 44.00
  assert.equal(data.rates[0].price, 44);
});
