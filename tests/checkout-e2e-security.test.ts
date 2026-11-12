import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);

const productId = "c1234567890123456789012345";
const variantId = "c1234567890123456789012346";
const userId = "c1234567890123456789012347";
const planId = "c1234567890123456789012348";
const orderId = "c1234567890123456789012349";
const couponId = "c1234567890123456789012350";
const winnerId = "c1234567890123456789012351";

let session: { user: { id: string; role: string; email?: string; name?: string } } | null = null;

let userState: {
  id: string;
  role: string;
  email: string;
  name: string;
  phone: string | null;
  isMember: boolean;
  memberSince: Date | null;
  membershipExpiry: Date | null;
  membershipAutoRenew: boolean;
  membershipStatus: string | null;
  membershipRetryCount: number;
  membershipNextRetryAt: Date | null;
  membershipCancelReason: string | null;
  membershipCancelledAt: Date | null;
};

let productState: {
  id: string;
  name: string;
  categoryId: string;
  basePrice: number;
  memberPrice: number | null;
  stock: number;
  isActive: boolean;
  weight: number;
  length: number;
  width: number;
  height: number;
};

let couponState: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: "ALL" | "PRODUCT" | "CATEGORY";
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usageCount: number;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  memberEligibility: "ALL" | "MEMBERS_ONLY" | "NON_MEMBERS";
  products: { productId: string }[];
  categories: { categoryId: string }[];
} | null;

let userCoupons: Array<{ userId: string; couponId: string; orderId: string }>;
let membershipPayments: Array<Record<string, any>>;
let orders: Array<Record<string, any>>;
let emailJobs: Array<Record<string, any>>;
let raffleWinners: Array<Record<string, any>>;
let dropStockBeforeCommit: boolean;
let stockDroppedAlready: boolean;

function resetState() {
  session = { user: { id: userId, role: "CUSTOMER", email: "buyer@example.com", name: "Test Buyer" } };
  userState = {
    id: userId,
    role: "CUSTOMER",
    email: "buyer@example.com",
    name: "Test Buyer",
    phone: "0400000000",
    isMember: false,
    memberSince: null,
    membershipExpiry: null,
    membershipAutoRenew: false,
    membershipStatus: null,
    membershipRetryCount: 0,
    membershipNextRetryAt: null,
    membershipCancelReason: null,
    membershipCancelledAt: null,
  };
  productState = {
    id: productId,
    name: "Air Purifier Pro",
    categoryId: "cat-1",
    basePrice: 100,
    memberPrice: 80,
    stock: 10,
    isActive: true,
    weight: 2,
    length: 30,
    width: 20,
    height: 15,
  };
  couponState = null;
  userCoupons = [];
  membershipPayments = [];
  orders = [];
  emailJobs = [];
  raffleWinners = [];
  dropStockBeforeCommit = false;
  stockDroppedAlready = false;
  require("../lib/rate-limit").clearRateLimitsForTests();
}

const db: any = {
  user: {
    findUnique: async ({ where }: any) => {
      if (where.id === "admin-user") return { id: "admin-user", role: "ADMIN" };
      return where.id === userState.id ? { ...userState } : null;
    },
    findUniqueOrThrow: async ({ where }: any) => {
      if (where.id !== userState.id) throw new Error("User not found");
      return { ...userState };
    },
    update: async ({ where, data }: any) => {
      if (where.id === userState.id) Object.assign(userState, data);
      return { ...userState };
    },
    updateMany: async ({ where, data }: any) => {
      if (where.id !== userState.id) return { count: 0 };
      if (where.membershipExpiry !== undefined) {
        const currentTime = userState.membershipExpiry?.getTime() ?? null;
        const targetTime = where.membershipExpiry?.getTime?.() ?? null;
        if (currentTime !== targetTime) return { count: 0 };
      }
      Object.assign(userState, data);
      return { count: 1 };
    },
  },
  membershipPlan: {
    findFirst: async () => ({ id: planId, name: "CHS Plus", price: 30, durationDays: 365, isActive: true, isDefault: true }),
    findUnique: async ({ where }: any) => (where.id === planId ? { id: planId, name: "CHS Plus", price: 30, durationDays: 365 } : null),
  },
  membershipPayment: {
    findFirst: async ({ where }: any) => {
      const or = where?.OR as Array<{ paywaySessionId?: string; stripeSessionId?: string }> | undefined;
      if (or) {
        return membershipPayments.find((p) => or.some((cond) => cond.paywaySessionId === p.paywaySessionId)) ?? null;
      }
      return membershipPayments[0] ?? null;
    },
    findUnique: async ({ where }: any) => {
      if (where.paywaySessionId) return membershipPayments.find((p) => p.paywaySessionId === where.paywaySessionId) ?? null;
      if (where.id) return membershipPayments.find((p) => p.id === where.id) ?? null;
      return null;
    },
    findMany: async ({ where }: any) => membershipPayments.filter((p) => p.userId === where.userId && !p.refundedAt && p.id !== where.id?.not),
    create: async ({ data }: any) => {
      const record = { id: `mp_${membershipPayments.length + 1}`, createdAt: new Date(), refundedAt: null, ...data };
      membershipPayments.push(record);
      return record;
    },
    update: async ({ where, data }: any) => {
      const payment = membershipPayments.find((p) => p.id === where.id);
      if (payment) Object.assign(payment, data);
      return payment;
    },
  },
  product: {
    findMany: async ({ where }: any) => {
      if (!productState.isActive) return [];
      const ids: string[] = where?.id?.in ?? [productState.id];
      if (!ids.includes(productState.id)) return [];
      return [{ ...productState, productVariants: [] }];
    },
    findUnique: async ({ where }: any) => (where.id === productState.id ? { ...productState } : null),
    updateMany: async ({ where, data }: any) => {
      if (dropStockBeforeCommit && !stockDroppedAlready) {
        stockDroppedAlready = true;
        productState.stock = 0;
      }
      if (where.id !== productState.id) return { count: 0 };
      if (where.stock?.gte !== undefined && productState.stock < where.stock.gte) return { count: 0 };
      if (data.stock?.decrement) productState.stock -= data.stock.decrement;
      if (data.stock?.increment) productState.stock += data.stock.increment;
      return { count: 1 };
    },
    update: async ({ where, data }: any) => {
      if (where.id === productState.id) {
        if (data.stock?.increment) productState.stock += data.stock.increment;
      }
      return { ...productState };
    },
  },
  productVariant: {
    findUnique: async () => null,
    updateMany: async () => ({ count: 0 }),
    update: async () => ({}),
  },
  coupon: {
    findUnique: async ({ where }: any) => {
      if (!couponState) return null;
      if (where.code && where.code !== couponState.code) return null;
      if (where.id && where.id !== couponState.id) return null;
      return { ...couponState };
    },
    update: async ({ where, data }: any) => {
      if (couponState && where.id === couponState.id) {
        if (data.usageCount?.increment) couponState.usageCount += data.usageCount.increment;
      }
      return couponState ? { ...couponState } : null;
    },
    updateMany: async ({ where, data }: any) => {
      if (!couponState || where.id !== couponState.id) return { count: 0 };
      if (where.usageCount?.gt !== undefined && couponState.usageCount <= where.usageCount.gt) return { count: 0 };
      if (data.usageCount?.decrement) couponState.usageCount -= data.usageCount.decrement;
      return { count: 1 };
    },
  },
  userCoupon: {
    count: async ({ where }: any) => userCoupons.filter((u) => u.userId === where.userId && u.couponId === where.couponId).length,
    create: async ({ data }: any) => {
      const rec = { ...data };
      userCoupons.push(rec);
      return rec;
    },
    deleteMany: async ({ where }: any) => {
      const before = userCoupons.length;
      userCoupons = userCoupons.filter((u) => u.orderId !== where.orderId);
      return { count: before - userCoupons.length };
    },
  },
  raffleWinner: {
    findUnique: async ({ where }: any) => raffleWinners.find((w) => w.id === where.id) ?? null,
    update: async ({ where, data }: any) => {
      const winner = raffleWinners.find((w) => w.id === where.id);
      if (winner) Object.assign(winner, data);
      return winner;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const winner of raffleWinners) {
        const matches = Object.entries(where).every(([k, v]) => (winner as any)[k] === v);
        if (matches) {
          Object.assign(winner, data);
          count++;
        }
      }
      return { count };
    },
  },
  address: {
    findFirst: async () => null,
  },
  orderItem: {
    aggregate: async ({ where }: any) => {
      let sum = 0;
      for (const o of orders) {
        if (o.status !== "PENDING") continue;
        if (where.order?.createdAt?.gte && o.createdAt < where.order.createdAt.gte) continue;
        for (const item of o.items) {
          if (item.productId === where.productId && (where.productVariantId === undefined || item.productVariantId === where.productVariantId)) {
            sum += item.quantity;
          }
        }
      }
      return { _sum: { quantity: sum } };
    },
  },
  order: {
    findFirst: async ({ where }: any) =>
      orders.find((o) => Object.entries(where).every(([k, v]) => o[k] === v)) ?? null,
    findMany: async () => [],
    findUnique: async ({ where }: any) => {
      const match = orders.find((o) => (where.id ? o.id === where.id : o.idempotencyKey === where.idempotencyKey));
      return match ? structuredClone(match) : null;
    },
    create: async ({ data }: any) => {
      const newOrder = {
        id: orderId,
        createdAt: new Date(),
        userId: data.user?.connect?.id ?? null,
        guestEmail: data.guestEmail ?? null,
        guestPhone: data.guestPhone ?? null,
        subtotal: data.subtotal,
        shippingCost: data.shippingCost,
        shippingServiceCode: data.shippingServiceCode,
        carrier: data.carrier,
        fulfillmentType: data.fulfillmentType,
        tax: data.tax,
        discount: data.discount,
        total: data.total,
        status: data.status,
        membershipAmount: data.membershipAmount ?? 0,
        membershipPlanId: data.membershipPlanId ?? null,
        membershipDurationDays: data.membershipDurationDays ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
        couponId: data.coupon?.connect?.id ?? null,
        couponCode: data.couponCode ?? null,
        couponReserved: data.couponReserved ?? false,
        paywayTransactionId: data.paywayTransactionId ?? null,
        refundRequested: false,
        refundAmount: null,
        refundProcessing: false,
        refundAttemptAmount: null,
        refundAttemptRestoreStock: null,
        refundReason: null,
        address: data.address?.create ?? null,
        user: data.user?.connect?.id ? { email: userState.email, name: userState.name, phone: userState.phone } : null,
        items: (data.items?.create ?? []).map((item: any) => ({ ...item, product: { name: productState.name } })),
      };
      orders.push(newOrder);
      return structuredClone(newOrder);
    },
    update: async ({ where, data }: any) => {
      const o = orders.find((row) => row.id === where.id);
      if (o) Object.assign(o, data);
      return o ? structuredClone(o) : null;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const o of orders) {
        const matches = Object.entries(where).every(([k, v]) => {
          if (v && typeof v === "object" && "in" in v) return (v.in as any[]).includes(o[k]);
          return o[k] === v;
        });
        if (matches) {
          Object.assign(o, data);
          count++;
        }
      }
      return { count };
    },
  },
  emailJob: {
    createMany: async ({ data }: { data: Array<Record<string, any>> }) => {
      for (const job of data) {
        if (!emailJobs.some((existing) => existing.key === job.key)) {
          emailJobs.push({ ...job });
        }
      }
      return { count: data.length };
    },
  },
  raffleAuditLog: {
    create: async () => ({}),
  },
  $queryRaw: async () => [],
  $transaction: async (fn: (tx: any) => Promise<any>) => {
    const snap = {
      userState: structuredClone(userState),
      productState: structuredClone(productState),
      couponState: structuredClone(couponState),
      userCoupons: structuredClone(userCoupons),
      membershipPayments: structuredClone(membershipPayments),
      orders: structuredClone(orders),
      emailJobs: structuredClone(emailJobs),
      raffleWinners: structuredClone(raffleWinners),
    };
    try {
      return await fn(db);
    } catch (err) {
      userState = snap.userState;
      productState = snap.productState;
      couponState = snap.couponState;
      userCoupons = snap.userCoupons;
      membershipPayments = snap.membershipPayments;
      orders = snap.orders;
      emailJobs = snap.emailJobs;
      raffleWinners = snap.raffleWinners;
      throw err;
    }
  },
};

function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}

stub("../auth", { auth: async () => session });
stub("../lib/db", { db });
stub("../lib/couriersplease", {
  checkCouriersPleaseAvailability: () => ({ available: true, reason: null }),
  getCouriersPleaseRates: async () => [{ serviceCode: "STANDARD", serviceName: "Standard Delivery", price: 15, deliveryTime: "3-5 business days" }],
});
stub("../lib/brevo", {
  sendOrderConfirmationEmail: async () => {},
  sendOrderCancellationEmail: async () => {},
  sendRefundRequestEmail: async () => {},
  sendEmail: async () => {},
});
stub("../lib/twilio", { sendOrderConfirmationSms: async () => {}, sendOrderWhatsApp: async () => {} });
stub("next/server", { ...require("next/server"), after: () => {} });
stub("next/cache", { revalidatePath: () => {}, revalidateTag: () => {} });
stub("next/navigation", {
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`) as Error & { redirectUrl?: string };
    err.redirectUrl = url;
    throw err;
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
});

const shippingRoute = require("../app/api/shipping/couriersplease/route").POST as typeof import("../app/api/shipping/couriersplease/route").POST;
const couponsRoute = require("../app/api/coupons/validate/route") as typeof import("../app/api/coupons/validate/route");
const checkoutRoute = require("../app/api/checkout/session/route").POST as typeof import("../app/api/checkout/session/route").POST;
const onlinepayWebhook = require("../app/api/webhooks/onlinepay/route").POST as typeof import("../app/api/webhooks/onlinepay/route").POST;
const pollPayment = require("../app/api/orders/[id]/poll-payment/route").GET as typeof import("../app/api/orders/[id]/poll-payment/route").GET;
const cancelOrder = require("../app/api/orders/[id]/cancel/route").POST as typeof import("../app/api/orders/[id]/cancel/route").POST;
const adminRefund = require("../app/api/admin/orders/[orderId]/refund/route").POST as typeof import("../app/api/admin/orders/[orderId]/refund/route").POST;
const legacyRates = require("../app/api/shipping/rates/route").POST as typeof import("../app/api/shipping/rates/route").POST;
const qaPage = require("../app/qa/page").default as typeof import("../app/qa/page").default;

const validAddress = {
  name: "Test Buyer",
  phone: "0400000000",
  line1: "123 George Street",
  suburb: "Sydney",
  state: "NSW" as const,
  postcode: "2000",
  country: "AU" as const,
};

function setEnv(t: TestContext, values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

const onlinePayEnv = {
  PAYMENT_GATEWAY: "onlinepay",
  NEXT_PUBLIC_PAYMENT_GATEWAY: "onlinepay",
  ONLINEPAY_MODE: "test",
  ONLINEPAY_RETURN_BASE_URL: "https://shop.example",
  ONLINEPAY_USER_UID: "uid-test",
  ONLINEPAY_API_KEY: "key-test",
  ONLINEPAY_ENTITY_ID: "entity-test",
  ONLINEPAY_PPC_ID: "ppc-test",
  ONLINEPAY_3DS_ID: "3ds-test",
  ONLINEPAY_WEBHOOK_SECRET: "a".repeat(32),
  AUTH_SECRET: "e2e-security-secret-key",
};

test("E2E OnlinePay flow: quote -> checkout (auth ignores spoofed guestEmail) -> webhook settle -> pre-ship cancel refund", async (t) => {
  resetState();
  setEnv(t, onlinePayEnv);
  t.mock.method(console, "error", () => {});

  let checkoutStatus: "initiated" | "paid" = "initiated";
  let refundedCents = 0;

  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/oidc/checkout-service/v2/checkout")) {
      const payload = JSON.parse(init?.body as string);
      assert.equal(payload.amount, 8000 + 1500 + 3000); // memberPrice $80 + $15 shipping + $30 membership
      return Response.json({ id: "chk-e2e-1", url: "https://pay.example/hpp/chk-e2e-1" });
    }
    if (u.endsWith("/oidc/checkout-service/v2/checkout/chk-e2e-1")) {
      return Response.json({
        id: "chk-e2e-1",
        merchant_reference: orderId,
        amount: 12500,
        currency_code: "AUD",
        transaction_id: "txn-op-12345",
        events: checkoutStatus === "paid" ? [{ type: "TRANSACTION_SUCCESS" }] : [],
      });
    }
    if (u.includes("/transactions/txn-op-12345/refund")) {
      const payload = JSON.parse(init?.body as string);
      refundedCents = payload.amount;
      return Response.json({ id: "ref-op-1", amount: payload.amount, payment_provider_contract: "ppc-test", status: "REFUNDED" });
    }
    throw new Error(`Unexpected fetch: ${u}`);
  });

  // 1. Live shipping quote
  const quoteRes = await shippingRoute(
    new NextRequest("https://shop.example/api/shipping/couriersplease", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.10" },
      body: JSON.stringify({ address: validAddress, items: [{ productId, quantity: 1 }] }),
    })
  );
  assert.equal(quoteRes.status, 200);
  const quoteData = await quoteRes.json();
  const stdRate = quoteData.rates[0];
  assert.equal(stdRate.price, 15);
  assert.ok(stdRate.quoteToken);

  // 2. Checkout creation while authenticated (even with spoofed guestEmail)
  const checkoutRes = await checkoutRoute(
    new NextRequest("https://shop.example/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.10" },
      body: JSON.stringify({
        items: [{ productId, quantity: 1 }],
        address: validAddress,
        guestEmail: "attacker@evil.com",
        shippingRateCode: stdRate.serviceCode,
        shippingCost: stdRate.price,
        shippingQuoteToken: stdRate.quoteToken,
        addMembership: true,
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      }),
    })
  );
  assert.equal(checkoutRes.status, 200);
  const checkoutJson = await checkoutRes.json();
  assert.equal(checkoutJson.status, "redirect");
  assert.equal(checkoutJson.guestToken, undefined); // Must never issue guestToken for signed-in order
  assert.equal(orders[0].guestEmail, null); // Spoofed guestEmail must not be stored
  assert.equal(orders[0].total, 125);
  assert.equal(orders[0].status, "PENDING");
  assert.equal(productState.stock, 10);

  // 3. Cancel attempt while OnlinePay has already captured is rejected 409 (race guard)
  checkoutStatus = "paid";
  const raceCancelRes = await cancelOrder(
    new NextRequest(`https://shop.example/api/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Cancel race" }),
    }),
    { params: Promise.resolve({ id: orderId }) }
  );
  assert.equal(raceCancelRes.status, 409);
  assert.equal(orders[0].status, "PENDING");

  // 4. OnlinePay webhook settles order atomically
  const webhookRes = await onlinepayWebhook(
    new NextRequest("https://shop.example/api/webhooks/onlinepay", {
      method: "POST",
      headers: { "content-type": "application/json", "x-onlinepay-webhook-secret": "a".repeat(32) },
      body: JSON.stringify({
        eventType: "Checkout - Transaction succeeded",
        eventId: "chk-e2e-1",
        content: { merchant_reference: orderId },
      }),
    })
  );
  assert.equal(webhookRes.status, 200);
  assert.equal(orders[0].status, "PAID");
  assert.equal(productState.stock, 9);
  assert.equal(userState.isMember, true);
  assert.equal(membershipPayments.length, 1);
  assert.ok(emailJobs.some((j) => j.key === `order:${orderId}:customer`));

  // 5. Customer cancel on order with membership creates refund review request; admin refund refunds payment, restores stock, reverses membership
  const cancelRes = await cancelOrder(
    new NextRequest(`https://shop.example/api/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Changed mind" }),
    }),
    { params: Promise.resolve({ id: orderId }) }
  );
  assert.equal(cancelRes.status, 200);
  const cancelJson = await cancelRes.json();
  assert.equal(cancelJson.autoRefunded, false);
  assert.equal(orders[0].refundRequested, true);

  session = { user: { id: "admin-user", role: "ADMIN", email: "admin@example.com", name: "Admin" } };
  const adminRefundRes = await adminRefund(
    new NextRequest(`https://shop.example/api/admin/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 125, reason: "Approved customer cancel", restoreStock: true }),
    }),
    { params: Promise.resolve({ orderId }) }
  );
  assert.equal(adminRefundRes.status, 200);
  assert.equal(refundedCents, 12500);
  assert.equal(orders[0].status, "REFUNDED");
  assert.equal(productState.stock, 10);
  assert.equal(userState.isMember, false);
  assert.ok(membershipPayments[0].refundedAt);
});

test("Security: NON_MEMBERS coupon + addMembership double-dip is rejected by both /api/coupons/validate and /api/checkout/session", async (t) => {
  resetState();
  setEnv(t, onlinePayEnv);
  couponState = {
    id: couponId,
    code: "WELCOME10",
    name: "Welcome $10",
    description: null,
    type: "ALL",
    discountType: "FIXED",
    discountValue: 10,
    maxDiscount: null,
    minOrderAmount: null,
    usageLimit: 10,
    perUserLimit: 1,
    usageCount: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    memberEligibility: "NON_MEMBERS",
    products: [],
    categories: [],
  };

  const validateRes = await couponsRoute.POST(
    new NextRequest("https://shop.example/api/coupons/validate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.11" },
      body: JSON.stringify({
        code: "WELCOME10",
        items: [{ productId, quantity: 1 }],
        addMembership: true,
      }),
    })
  );
  assert.equal(validateRes.status, 400);
  assert.match((await validateRes.json()).error, /non-members/i);

  const checkoutRes = await checkoutRoute(
    new NextRequest("https://shop.example/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.11" },
      body: JSON.stringify({
        items: [{ productId, quantity: 1 }],
        address: validAddress,
        couponCode: "WELCOME10",
        addMembership: true,
        fulfillmentType: "STORE_PICKUP",
        shippingRateCode: "STORE_PICKUP",
        shippingCost: 0,
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      }),
    })
  );
  assert.equal(checkoutRes.status, 400);
  assert.match((await checkoutRes.json()).error, /non-members/i);
  assert.equal(orders.length, 0);
});

test("Free $0 order OUT_OF_STOCK race returns 409 cleanly, releases coupon reservation, and restores raffleWinner to PENDING_CLAIM", async (t) => {
  resetState();
  setEnv(t, onlinePayEnv);
  couponState = {
    id: couponId,
    code: "FREE100",
    name: "100% Off",
    description: null,
    type: "ALL",
    discountType: "PERCENTAGE",
    discountValue: 100,
    maxDiscount: null,
    minOrderAmount: null,
    usageLimit: 5,
    perUserLimit: 1,
    usageCount: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    memberEligibility: "ALL",
    products: [],
    categories: [],
  };
  raffleWinners.push({
    id: winnerId,
    userId,
    status: "PENDING_CLAIM",
    orderId: null,
    claimedAt: null,
    prizeType: "FREE_PRODUCT",
    winningPrice: 0,
    prize: { productId, price: 0 },
    raffle: { slug: "test-raffle", title: "Test Raffle" },
  });
  dropStockBeforeCommit = true;

  const res = await checkoutRoute(
    new NextRequest("https://shop.example/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.12" },
      body: JSON.stringify({
        items: [{ productId, quantity: 2 }],
        address: validAddress,
        couponCode: "FREE100",
        fulfillmentType: "STORE_PICKUP",
        shippingRateCode: "STORE_PICKUP",
        shippingCost: 0,
        raffleWinnerId: winnerId,
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
      }),
    })
  );
  assert.equal(res.status, 409);
  assert.equal((await res.json()).status, "out_of_stock");
  assert.equal(orders[0].status, "CANCELLED");
  assert.equal(orders[0].refundRequested, false);
  assert.equal(orders[0].couponReserved, false);
  assert.equal(couponState.usageCount, 0);
  assert.equal(userCoupons.length, 0);
  assert.equal(raffleWinners[0].status, "PENDING_CLAIM");
  assert.equal(raffleWinners[0].orderId, null);
});

test("PayWay post-payment OUT_OF_STOCK cancels with refund flag, releases coupon, and restores raffleWinner", async (t) => {
  resetState();
  setEnv(t, {
    PAYMENT_GATEWAY: "payway",
    NEXT_PUBLIC_PAYMENT_GATEWAY: "payway",
    PAYWAY_SECRET_KEY: "pw-secret",
    PAYWAY_MERCHANT_ID: "TEST",
    AUTH_SECRET: "e2e-security-secret-key",
  });
  t.mock.method(console, "error", () => {});

  couponState = {
    id: couponId,
    code: "SAVE20",
    name: "Save 20",
    description: null,
    type: "ALL",
    discountType: "FIXED",
    discountValue: 20,
    maxDiscount: null,
    minOrderAmount: null,
    usageLimit: 5,
    perUserLimit: 1,
    usageCount: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    memberEligibility: "ALL",
    products: [],
    categories: [],
  };
  raffleWinners.push({
    id: winnerId,
    userId,
    status: "PENDING_CLAIM",
    orderId: null,
    claimedAt: null,
    prizeType: "FREE_PRODUCT",
    winningPrice: 0,
    prize: { productId, price: 0 },
    raffle: { slug: "test-raffle", title: "Test Raffle" },
  });
  dropStockBeforeCommit = true;

  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      transactionId: 987654,
      receiptNumber: "REC-987654",
      status: "approved",
      responseCode: "00",
      responseText: "Approved",
      transactionType: "payment",
      customerNumber: "1",
      orderNumber: orderId,
      currency: "aud",
      principalAmount: 130,
    })
  );

  const res = await checkoutRoute(
    new NextRequest("https://shop.example/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.13" },
      body: JSON.stringify({
        singleUseTokenId: "55555555-5555-4555-8555-555555555555",
        items: [{ productId, quantity: 2 }],
        address: validAddress,
        couponCode: "SAVE20",
        fulfillmentType: "STORE_PICKUP",
        shippingRateCode: "STORE_PICKUP",
        shippingCost: 0,
        raffleWinnerId: winnerId,
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
      }),
    })
  );
  assert.equal(res.status, 409);
  assert.equal((await res.json()).status, "out_of_stock");
  assert.equal(orders[0].status, "CANCELLED");
  assert.equal(orders[0].refundRequested, true);
  assert.equal(couponState.usageCount, 0);
  assert.equal(userCoupons.length, 0);
  assert.equal(raffleWinners[0].status, "PENDING_CLAIM");
  assert.ok(emailJobs.some((j) => j.key === `order:${orderId}:refund-action`));
});

test("poll-payment post-payment OUT_OF_STOCK cancels, queues refund action, releases coupon, and restores raffleWinner", async (t) => {
  resetState();
  setEnv(t, onlinePayEnv);
  t.mock.method(console, "error", () => {});

  couponState = {
    id: couponId,
    code: "POLL10",
    name: "Poll 10",
    description: null,
    type: "ALL",
    discountType: "FIXED",
    discountValue: 10,
    maxDiscount: null,
    minOrderAmount: null,
    usageLimit: 5,
    perUserLimit: 1,
    usageCount: 1,
    isActive: true,
    startDate: null,
    endDate: null,
    memberEligibility: "ALL",
    products: [],
    categories: [],
  };
  userCoupons.push({ userId, couponId, orderId });
  raffleWinners.push({ id: winnerId, userId, status: "CLAIMED", orderId, claimedAt: new Date() });
  orders.push({
    id: orderId,
    userId,
    guestEmail: null,
    status: "PENDING",
    total: 90,
    membershipAmount: 0,
    membershipPlanId: null,
    membershipDurationDays: null,
    couponId,
    couponReserved: true,
    paywayTransactionId: "ONLINEPAY:chk-poll-oos",
    items: [{ productId, productVariantId: null, quantity: 1, product: { name: productState.name } }],
  });
  productState.stock = 0;

  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      id: "chk-poll-oos",
      merchant_reference: orderId,
      amount: 9000,
      currency_code: "AUD",
      transaction_id: "txn-poll-oos",
      events: [{ type: "TRANSACTION_SUCCESS" }],
    })
  );

  const pollRes = await pollPayment(
    new NextRequest(`https://shop.example/api/orders/${orderId}/poll-payment`),
    { params: Promise.resolve({ id: orderId }) }
  );
  assert.equal(pollRes.status, 409);
  assert.equal(orders[0].status, "CANCELLED");
  assert.equal(orders[0].refundRequested, true);
  assert.equal(couponState.usageCount, 0);
  assert.equal(userCoupons.length, 0);
  assert.equal(raffleWinners[0].status, "PENDING_CLAIM");
  assert.equal(raffleWinners[0].orderId, null);
  assert.ok(emailJobs.some((j) => j.key === `order:${orderId}:refund-action`));
});

test("Rate limits coupon enumeration, retires /api/shipping/rates (410), and restricts /qa to admins", async (t) => {
  resetState();
  setEnv(t, onlinePayEnv);
  session = null;
  couponState = {
    id: couponId,
    code: "PUBLIC10",
    name: "Public 10",
    description: null,
    type: "ALL",
    discountType: "FIXED",
    discountValue: 10,
    maxDiscount: null,
    minOrderAmount: null,
    usageLimit: 100,
    perUserLimit: null,
    usageCount: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    memberEligibility: "ALL",
    products: [],
    categories: [],
  };

  for (let i = 0; i < 20; i++) {
    const res = await couponsRoute.POST(
      new NextRequest("https://shop.example/api/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.77" },
        body: JSON.stringify({ code: "PUBLIC10", items: [{ productId, quantity: 1 }] }),
      })
    );
    assert.equal(res.status, 200);
  }
  const blocked = await couponsRoute.POST(
    new NextRequest("https://shop.example/api/coupons/validate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.77" },
      body: JSON.stringify({ code: "PUBLIC10", items: [{ productId, quantity: 1 }] }),
    })
  );
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get("Retry-After"));

  const legacyRes = await legacyRates();
  assert.equal(legacyRes.status, 410);

  // Unauthenticated and non-admin callers must be redirected away from /qa
  await assert.rejects(() => qaPage(), (err: any) => err?.redirectUrl === "/login?callbackUrl=/qa");
  session = { user: { id: userId, role: "CUSTOMER", email: "buyer@example.com" } };
  await assert.rejects(() => qaPage(), (err: any) => err?.redirectUrl === "/login?callbackUrl=/qa");
});

test("Checkout session places member free delivery order at $0 shipping and member fixed delivery order at fixed rate", async (t) => {
  resetState();
  setEnv(t, onlinePayEnv);
  userState.isMember = true;
  userState.membershipExpiry = new Date(Date.now() + 86400000);

  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("/oidc/checkout-service/v2/checkout")) {
      return Response.json({ id: "chk-member-delivery", url: "https://pay.example/hpp/chk-member-delivery" });
    }
    throw new Error(`Unexpected fetch: ${u}`);
  });

  // 1. Member Free Delivery
  (productState as any).memberFreeDelivery = true;
  (productState as any).memberDeliveryCharge = null;

  const freeQuoteRes = await shippingRoute(
    new NextRequest("https://shop.example/api/shipping/couriersplease", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.11" },
      body: JSON.stringify({ address: validAddress, items: [{ productId, quantity: 1 }] }),
    })
  );
  assert.equal(freeQuoteRes.status, 200);
  const freeQuoteData = await freeQuoteRes.json();
  const freeRate = freeQuoteData.rates[0];
  assert.equal(freeRate.serviceCode, "MEMBER_FREE_DELIVERY");
  assert.equal(freeRate.price, 0);

  const freeCheckoutRes = await checkoutRoute(
    new NextRequest("https://shop.example/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.11" },
      body: JSON.stringify({
        items: [{ productId, quantity: 1 }],
        address: validAddress,
        shippingRateCode: freeRate.serviceCode,
        shippingCost: freeRate.price,
        shippingQuoteToken: freeRate.quoteToken,
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      }),
    })
  );
  assert.equal(freeCheckoutRes.status, 200);
  assert.equal(orders[0].shippingCost, 0);
  assert.equal(orders[0].shippingServiceCode, "MEMBER_FREE_DELIVERY");

  // 2. Member Fixed Delivery ($15 * 2 = $30)
  (productState as any).memberFreeDelivery = false;
  (productState as any).memberDeliveryCharge = 15;

  const fixedQuoteRes = await shippingRoute(
    new NextRequest("https://shop.example/api/shipping/couriersplease", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.12" },
      body: JSON.stringify({ address: validAddress, items: [{ productId, quantity: 2 }] }),
    })
  );
  assert.equal(fixedQuoteRes.status, 200);
  const fixedQuoteData = await fixedQuoteRes.json();
  const fixedRate = fixedQuoteData.rates[0];
  assert.equal(fixedRate.serviceCode, "MEMBER_FIXED_DELIVERY");
  assert.equal(fixedRate.price, 30);

  const fixedCheckoutRes = await checkoutRoute(
    new NextRequest("https://shop.example/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.12" },
      body: JSON.stringify({
        items: [{ productId, quantity: 2 }],
        address: validAddress,
        shippingRateCode: fixedRate.serviceCode,
        shippingCost: fixedRate.price,
        shippingQuoteToken: fixedRate.quoteToken,
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
      }),
    })
  );
  assert.equal(fixedCheckoutRes.status, 200);
  assert.equal(orders[1].shippingCost, 30);
  assert.equal(orders[1].shippingServiceCode, "MEMBER_FIXED_DELIVERY");

  // 3. Price mismatch / tampering rejection
  const tamperedCheckoutRes = await checkoutRoute(
    new NextRequest("https://shop.example/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.13" },
      body: JSON.stringify({
        items: [{ productId, quantity: 2 }],
        address: validAddress,
        shippingRateCode: fixedRate.serviceCode,
        shippingCost: 5,
        shippingQuoteToken: fixedRate.quoteToken,
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
      }),
    })
  );
  assert.equal(tamperedCheckoutRes.status, 400);
  const tamperedJson = await tamperedCheckoutRes.json();
  assert.ok(tamperedJson.error.includes("Shipping cost mismatch"));
});
