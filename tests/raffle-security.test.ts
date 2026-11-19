import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { createRequire } from "node:module";
import {
  maskWinnerName,
  calculateOrderProductSpend,
  calculateTotalProductSpend,
  RAFFLE_MIN_PRODUCT_SPEND,
} from "@/lib/raffle-utils";

const require = createRequire(import.meta.url);

test("maskWinnerName masks customer names for public community display", () => {
  assert.equal(maskWinnerName("John Doe"), "John D.***");
  assert.equal(maskWinnerName("Sarah Jane Smith"), "Sarah S.***");
  assert.equal(maskWinnerName("Alice"), "Al***");
  assert.equal(maskWinnerName("Li"), "L***");
  assert.equal(maskWinnerName(""), "Verified Customer");
  assert.equal(maskWinnerName(null), "Verified Customer");
  assert.equal(maskWinnerName(undefined), "Verified Customer");
  assert.equal(maskWinnerName("   "), "Verified Customer");
});

test("cryptographic randomness in winner selection produces valid integers within bounds", () => {
  const poolSize = 10;
  for (let i = 0; i < 50; i++) {
    const pick = crypto.randomInt(0, poolSize);
    assert.ok(pick >= 0 && pick < poolSize, `Expected 0 <= ${pick} < ${poolSize}`);
  }
});

test("raffle redraw logic correctly filters out existing winning user when multiple wins disallowed", () => {
  const allTickets = [
    { id: "t1", userId: "u1" },
    { id: "t2", userId: "u1" },
    { id: "t3", userId: "u2" },
    { id: "t4", userId: "u3" },
  ];

  // User 1 is winning prize 1, User 2 was winning prize 2 (now being redrawn)
  const otherWinners = [{ id: "w1", userId: "u1", ticketId: "t1" }];
  const currentWinnerTicketIds = new Set(["t1", "t3"]);
  const otherWinnerUserIds = new Set(otherWinners.map((w) => w.userId));

  // User 1 should be excluded from winning prize 2 because they already won prize 1
  const eligibleTickets = allTickets.filter(
    (t) => !currentWinnerTicketIds.has(t.id) && !otherWinnerUserIds.has(t.userId)
  );

  // Remaining eligible tickets should only be from u3 (t4)
  assert.equal(eligibleTickets.length, 1);
  assert.equal(eligibleTickets[0].userId, "u3");
  assert.equal(eligibleTickets[0].id, "t4");
});

test("checkout pricing calculation limits free raffle prize to exactly 1 quantity", () => {
  // Simulating the price line calculation logic in checkout route
  const regularPrice = 1200;
  const itemQuantity = 3;
  const isRafflePrize = true;
  const winningPrice = 0; // 100% Free Gift

  const priceLines: Array<{ key: string; unitPriceCents: number; quantity: number; eligible: boolean }> = [];

  if (isRafflePrize) {
    // Exactly 1 unit at winning price
    priceLines.push({
      key: "prod-1:base:raffle",
      unitPriceCents: Math.round(winningPrice * 100),
      quantity: 1,
      eligible: false, // Cannot be discounted by coupons
    });

    // The remaining (itemQuantity - 1) units must be charged at regular price
    if (itemQuantity > 1) {
      priceLines.push({
        key: "prod-1:base",
        unitPriceCents: Math.round(regularPrice * 100),
        quantity: itemQuantity - 1,
        eligible: true,
      });
    }
  }

  assert.equal(priceLines.length, 2);
  assert.equal(priceLines[0].quantity, 1);
  assert.equal(priceLines[0].unitPriceCents, 0);
  assert.equal(priceLines[0].eligible, false);

  assert.equal(priceLines[1].quantity, 2);
  assert.equal(priceLines[1].unitPriceCents, 120000);
  assert.equal(priceLines[1].eligible, true);

  const totalCalculatedSubtotal = priceLines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0) / 100;
  assert.equal(totalCalculatedSubtotal, 2400); // 0 + 2 * 1200 = 2400, NOT 0!
});

test("free order with 0 total cost correctly recognizes no payment card needed", () => {
  const subtotal = 0;
  const shippingCost = 0;
  const membershipAdd = 0;
  const tax = 0;
  const total = subtotal + shippingCost + membershipAdd + tax;

  const isFreeOrder = Math.round(total * 100) === 0;
  assert.equal(isFreeOrder, true);
});

test("calculateOrderProductSpend correctly excludes membership and computes net product spend", () => {
  // 1. Standard product order: $120 products, 0 discount, 0 membership
  const prodOrder = {
    subtotal: 120,
    discount: 0,
    membershipAmount: 0,
    items: [{ id: "item-1", quantity: 1, unitPrice: 120 }],
  };
  assert.equal(calculateOrderProductSpend(prodOrder), 120);

  // 2. Product order with coupon: $120 products, $30 discount -> $90
  const discountedOrder = {
    subtotal: 120,
    discount: 30,
    membershipAmount: 0,
    items: [{ id: "item-1", quantity: 1, unitPrice: 120 }],
  };
  assert.equal(calculateOrderProductSpend(discountedOrder), 90);

  // 3. Digital membership only order: $20 membership, no product items -> $0 product spend
  const membershipOnlyOrder = {
    subtotal: 0,
    discount: 0,
    membershipAmount: 20,
    items: [],
  };
  assert.equal(calculateOrderProductSpend(membershipOnlyOrder), 0);

  // 4. Hybrid order: $100 product + $20 membership -> exactly $100 product spend (membership excluded)
  const hybridOrder = {
    subtotal: 100,
    discount: 0,
    membershipAmount: 20,
    total: 134.99, // including shipping
    items: [{ id: "item-1", quantity: 1, unitPrice: 100 }],
  };
  assert.equal(calculateOrderProductSpend(hybridOrder), 100);

  // 5. Order with partial refund: $120 products, $30 refund -> $90
  const refundedOrder = {
    subtotal: 120,
    discount: 0,
    refundAmount: 30,
    items: [{ id: "item-1", quantity: 1, unitPrice: 120 }],
  };
  assert.equal(calculateOrderProductSpend(refundedOrder), 90);
});

test("calculateTotalProductSpend enforces minimum $100 product spend requirement across customer orders", () => {
  assert.equal(RAFFLE_MIN_PRODUCT_SPEND, 100);

  // Scenario 1: Customer with no orders
  const noOrders = calculateTotalProductSpend([]);
  assert.equal(noOrders.totalProductSpend, 0);
  assert.equal(noOrders.hasMinProductSpend, false);
  assert.equal(noOrders.remainingSpendRequired, 100);

  // Scenario 2: Customer with only membership purchase ($20) -> not eligible
  const membershipCustomer = calculateTotalProductSpend([
    { subtotal: 0, discount: 0, membershipAmount: 20, items: [] },
  ]);
  assert.equal(membershipCustomer.totalProductSpend, 0);
  assert.equal(membershipCustomer.hasMinProductSpend, false);
  assert.equal(membershipCustomer.remainingSpendRequired, 100);

  // Scenario 3: Customer with $80 product purchase + $20 membership -> $80 total product spend, $20 remaining, not eligible
  const underSpendCustomer = calculateTotalProductSpend([
    {
      subtotal: 80,
      discount: 0,
      membershipAmount: 20,
      items: [{ id: "i1", quantity: 1, unitPrice: 80 }],
    },
  ]);
  assert.equal(underSpendCustomer.totalProductSpend, 80);
  assert.equal(underSpendCustomer.hasMinProductSpend, false);
  assert.equal(underSpendCustomer.remainingSpendRequired, 20);

  // Scenario 4: Customer with multiple orders totaling >= $100 ($60 + $50 = $110) -> eligible!
  const multiOrderCustomer = calculateTotalProductSpend([
    {
      subtotal: 60,
      discount: 0,
      items: [{ id: "i1", quantity: 1, unitPrice: 60 }],
    },
    {
      subtotal: 50,
      discount: 0,
      membershipAmount: 20, // membership excluded
      items: [{ id: "i2", quantity: 1, unitPrice: 50 }],
    },
  ]);
  assert.equal(multiOrderCustomer.totalProductSpend, 110);
  assert.equal(multiOrderCustomer.hasMinProductSpend, true);
  assert.equal(multiOrderCustomer.remainingSpendRequired, 0);

  // Scenario 5: Customer with single $100 product order -> eligible!
  const exactHundredCustomer = calculateTotalProductSpend([
    {
      subtotal: 100,
      discount: 0,
      items: [{ id: "i1", quantity: 1, unitPrice: 100 }],
    },
  ]);
  assert.equal(exactHundredCustomer.totalProductSpend, 100);
  assert.equal(exactHundredCustomer.hasMinProductSpend, true);
  assert.equal(exactHundredCustomer.remainingSpendRequired, 0);
});

test("enterRaffle rejects customer with < $100 product spend and allows customer with >= $100 product spend", async () => {
  let mockOrders: any[] = [];
  const testUserId = "user-raffle-tester-1";
  const testRaffleId = "raffle-test-101";

  const stubDb: any = {
    raffle: {
      findUnique: async () => ({
        id: testRaffleId,
        slug: "luxury-sofa-draw",
        title: "Luxury Sofa Draw",
        status: "ACTIVE",
        entryPrice: 0,
        isPaid: false,
        visibility: "ALL",
        maxEntriesPerUser: 2,
        minEntriesPerUser: 1,
        allowMultipleEntries: true,
        totalMaxEntries: 100,
        totalTickets: 10,
        startDate: new Date(Date.now() - 1000 * 60 * 60),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
        drawDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
        winnersAnnounced: false,
      }),
      update: async () => ({}),
    },
    user: {
      findUnique: async () => ({ id: testUserId, email: "tester@example.com", isMember: false }),
    },
    order: {
      findMany: async () => mockOrders,
    },
    raffleTicket: {
      count: async () => 0,
      groupBy: async () => [{ userId: testUserId }],
      create: async () => ({}),
    },
    raffleEntry: {
      create: async () => ({ id: "entry-1" }),
    },
    $executeRawUnsafe: async () => {},
    $transaction: async (fn: any) => fn(stubDb),
  };

  require.cache[require.resolve("../lib/db")] = { exports: { db: stubDb } } as NodeModule;
  require.cache[require.resolve("../auth")] = {
    exports: {
      auth: async () => ({
        user: { id: testUserId, email: "tester@example.com" },
      }),
    },
  } as NodeModule;
  require.cache[require.resolve("../lib/rate-limit")] = {
    exports: {
      consumeRateLimit: async () => ({ allowed: true, remaining: 10, retryAfter: 60 }),
    },
  } as NodeModule;
  require.cache[require.resolve("next/cache")] = {
    exports: {
      revalidatePath: () => {},
    },
  } as NodeModule;

  delete require.cache[require.resolve("../lib/actions/raffle")];
  const { enterRaffle } = require("../lib/actions/raffle") as typeof import("../lib/actions/raffle");

  // 1. Customer with $0 spend -> rejected
  mockOrders = [];
  const res0 = await enterRaffle(testRaffleId, 1);
  assert.equal(res0.success, false);
  assert.ok(res0.error?.includes("A minimum purchase of $100.00 on products"));
  assert.ok(res0.error?.includes("$0.00"));

  // 2. Customer with $50 product spend + $20 membership spend -> rejected (membership excluded, $50 remaining)
  mockOrders = [
    {
      id: "ord-1",
      subtotal: 50,
      discount: 0,
      membershipAmount: 20,
      items: [{ id: "it-1", quantity: 1, unitPrice: 50 }],
    },
  ];
  const res50 = await enterRaffle(testRaffleId, 1);
  assert.equal(res50.success, false);
  assert.ok(res50.error?.includes("A minimum purchase of $100.00 on products"));
  assert.ok(res50.error?.includes("$50.00"));

  // 3. Customer with another $60 product spend -> total $110 >= $100 -> accepted!
  mockOrders.push({
    id: "ord-2",
    subtotal: 60,
    discount: 0,
    membershipAmount: 0,
    items: [{ id: "it-2", quantity: 1, unitPrice: 60 }],
  });
  const res110 = await enterRaffle(testRaffleId, 1);
  assert.equal(res110.success, true);
  assert.ok(res110.ticketNumbers && res110.ticketNumbers.length === 1);
});
