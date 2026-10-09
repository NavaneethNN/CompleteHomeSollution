import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
const productId = "c1234567890123456789012345";
const variantId = "c1234567890123456789012346";
let memberProductPrice = 10;
let activeVariants: Array<{ id: string; productId: string; price: number; memberPrice: number | null; stock: number; isActive: boolean; weight: number; length: number; width: number; height: number }> = [];
let order: Record<string, any> | null;
let coupon: Record<string, any> | null;
let failCheckoutIdSave: boolean;
let usageCount: number;
let userCouponCount: number;
let pendingQuantity: number;

const db: any = {
  emailJob: { createMany: async () => ({ count: 2 }) },
  user: { findUnique: async () => ({ isMember: true, membershipExpiry: null }) },
  product: {
    findMany: async () => [{ id: productId, name: "Test chair", categoryId: "category", basePrice: 10, memberPrice: memberProductPrice, stock: 100, weight: 2, length: 30, width: 20, height: 15, productVariants: activeVariants }],
    findUnique: async () => ({ stock: 100, isActive: true }),
  },
  productVariant: { findUnique: async () => activeVariants[0] ?? null },
  orderItem: { aggregate: async () => ({ _sum: { quantity: pendingQuantity } }) },
  membershipPlan: { findFirst: async () => null },
  coupon: {
    findUnique: async () => coupon ? { ...coupon, usageCount } : null,
    update: async () => { usageCount++; return coupon; },
    updateMany: async () => ({ count: 1 }),
  },
  userCoupon: {
    count: async () => userCouponCount,
    create: async () => { userCouponCount++; },
    deleteMany: async () => { const count = userCouponCount; userCouponCount = 0; return { count }; },
  },
  order: {
    findUnique: async () => order,
    create: async ({ data, include }: any) => {
      void include;
      order = {
        ...data,
        id: productId,
        userId: "user",
        guestEmail: null,
        guestPhone: null,
        paywayTransactionId: null,
        user: { email: "buyer@example.com", name: "Buyer", phone: null },
        address: data.address.create,
        items: data.items.create.map((item: any) => ({ ...item, product: { name: "Test chair" } })),
      };
      return structuredClone(order);
    },
    update: async ({ data }: any) => {
      if (data.paywayTransactionId && failCheckoutIdSave) {
        failCheckoutIdSave = false;
        throw new Error("simulated local save failure");
      }
      Object.assign(order!, data);
      return order;
    },
    updateMany: async ({ where, data }: any) => {
      if (!order || (where.status && order.status !== where.status)) return { count: 0 };
      Object.assign(order, data);
      return { count: 1 };
    },
  },
  $queryRaw: async () => [],
  $transaction: async (fn: (tx: any) => Promise<any>) => fn(db),
};

function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}
stub("../auth", { auth: async () => ({ user: { id: "user", role: "CUSTOMER", email: "buyer@example.com" } }) });
stub("../lib/db", { db });
stub("../lib/brevo", { sendOrderConfirmationEmail: async () => {} });
stub("../lib/twilio", { sendOrderConfirmationSms: async () => {}, sendOrderWhatsApp: async () => {} });
stub("next/server", { ...require("next/server"), after: () => {} });
const checkout = require("../app/api/checkout/session/route").POST as typeof import("../app/api/checkout/session/route").POST;

const address = { name: "Test Buyer", phone: "0400000000", line1: "1 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000", country: "AU" };
const baseBody = { items: [{ productId, quantity: 3 }], address, idempotencyKey: "6b620acb-5819-43f9-961e-1c1cdd331233" };

function request(body: unknown) {
  return new NextRequest("https://shop.example/api/checkout/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function setup(t: TestContext) {
  order = null; coupon = null; failCheckoutIdSave = false; usageCount = 0; userCouponCount = 0; pendingQuantity = 0; memberProductPrice = 10; activeVariants = [];
  const values = { PAYMENT_GATEWAY: "onlinepay", ONLINEPAY_MODE: "test", ONLINEPAY_RETURN_BASE_URL: "https://shop.example", ONLINEPAY_USER_UID: "test", ONLINEPAY_API_KEY: "test", ONLINEPAY_ENTITY_ID: "test", ONLINEPAY_PPC_ID: "test", ONLINEPAY_3DS_ID: "test", AUTH_SECRET: "checkout-readiness-test" };
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  t.mock.method(console, "error", () => {});
}

test("unknown OnlinePay creation outcome remains pending under the original key", async t => {
  setup(t);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("lost provider response"); });
  const response = await checkout(request(baseBody));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "pending");
  assert.equal(order?.status, "PENDING");
});

test("regular checkout rejects oversized billing fields and malformed JSON before order creation", async t => {
  setup(t);
  const longAddress = { ...address, line1: "A".repeat(121) };
  const oversized = await checkout(request({ ...baseBody, address: longAddress }));
  assert.equal(oversized.status, 400);
  assert.equal(order, null);
  const malformed = await checkout(new NextRequest("https://shop.example/api/checkout/session", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{broken",
  }));
  assert.equal(malformed.status, 400);
  assert.equal(order, null);
});

test("OnlinePay setup rejects HTTP returns and an HTTPS localhost return on a different origin", async t => {
  setup(t);
  process.env.ONLINEPAY_RETURN_BASE_URL = "http://localhost:3000";
  const insecure = await checkout(request(baseBody));
  assert.equal(insecure.status, 503);
  assert.match((await insecure.json()).error, /requires HTTPS/);
  process.env.ONLINEPAY_RETURN_BASE_URL = "https://localhost:3000";
  const mismatched = await checkout(request(baseBody));
  assert.equal(mismatched.status, 503);
  assert.match((await mismatched.json()).error, /different address/);
  assert.equal(order, null);
});

test("pending stock holds block a second checkout before a provider payment is created", async t => {
  setup(t);
  pendingQuantity = 98;
  let providerCalls = 0;
  t.mock.method(globalThis, "fetch", async () => { providerCalls++; return Response.json({}); });
  const response = await checkout(request(baseBody));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /held by another checkout/);
  assert.equal(order, null);
  assert.equal(providerCalls, 0);
});

test("provider acceptance followed by local ID-save failure preserves the hosted checkout", async t => {
  setup(t); failCheckoutIdSave = true;
  t.mock.method(globalThis, "fetch", async () => Response.json({ id: "checkout-123", url: "https://provider.example/checkout" }));
  const response = await checkout(request(baseBody));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, "redirect");
  assert.equal(result.checkoutUrl, "https://provider.example/checkout");
  assert.equal(order?.status, "PENDING");
});

test("coupon cents match stored totals and provider lines while allowance is reserved", async t => {
  setup(t);
  coupon = { id: "coupon", code: "SAVE1", isActive: true, type: "GLOBAL", discountType: "FIXED", discountValue: 1, maxDiscount: null, minOrderAmount: null, usageLimit: 1, perUserLimit: 1, startDate: null, endDate: null, memberEligibility: "ALL", products: [], categories: [] };
  let providerTotal = 0;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const payload = JSON.parse(init.body as string);
    providerTotal = payload.line_items.reduce((sum: number, line: any) => sum + line.total_amount, 0);
    return Response.json({ id: "checkout-123", url: "https://provider.example/checkout" });
  });
  const response = await checkout(request({ ...baseBody, couponCode: "SAVE1" }));
  assert.equal(response.status, 200);
  assert.equal(order?.discount, 1);
  assert.equal(order?.subtotal, 29);
  assert.equal(order?.tax, 2.9);
  assert.equal(order?.total, 31.9);
  assert.equal(providerTotal, 3190);
  assert.equal(usageCount, 1);
  assert.equal(userCouponCount, 1);
  assert.equal(order?.couponReserved, true);
});

test("variant checkout inherits the product member price in the order and provider charge", async t => {
  setup(t);
  memberProductPrice = 7;
  activeVariants = [{ id: variantId, productId, price: 10, memberPrice: null, stock: 100, isActive: true, weight: 2, length: 30, width: 20, height: 15 }];
  let providerTotal = 0;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const payload = JSON.parse(init.body as string);
    providerTotal = payload.line_items.reduce((sum: number, line: any) => sum + line.total_amount, 0);
    return Response.json({ id: "checkout-123", url: "https://provider.example/checkout" });
  });
  const response = await checkout(request({ ...baseBody, items: [{ productId, variantId, quantity: 3 }] }));
  assert.equal(response.status, 200);
  assert.equal(order?.subtotal, 21);
  assert.equal(order?.items[0].unitPrice, 7);
  assert.equal(providerTotal, 2310);
});
