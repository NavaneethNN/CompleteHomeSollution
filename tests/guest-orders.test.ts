import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-order-access";

import { claimGuestOrdersForUser, getGuestSessionOrders, lookupGuestOrder } from "../lib/guest-orders";
import { createGuestOrderToken } from "../lib/order-access";
import { db } from "../lib/db";

test("claimGuestOrdersForUser links unassigned guest orders and addresses to user account", async (t) => {
  // Mock db methods
  const originalOrderFindMany = db.order.findMany;
  const originalOrderUpdateMany = db.order.updateMany;
  const originalAddressUpdateMany = db.address.updateMany;

  t.after(() => {
    db.order.findMany = originalOrderFindMany;
    db.order.updateMany = originalOrderUpdateMany;
    db.address.updateMany = originalAddressUpdateMany;
  });

  let updatedOrderWhere: any = null;
  let updatedOrderData: any = null;
  let updatedAddressWhere: any = null;
  let updatedAddressData: any = null;

  db.order.findMany = (async (args: any) => {
    assert.equal(args.where.userId, null);
    assert.equal(args.where.guestEmail.equals, "test@example.com");
    assert.equal(args.where.guestEmail.mode, "insensitive");
    return [
      { id: "order_1", addressId: "addr_1" },
      { id: "order_2", addressId: "addr_2" },
    ];
  }) as any;

  db.order.updateMany = (async (args: any) => {
    updatedOrderWhere = args.where;
    updatedOrderData = args.data;
    return { count: 2 };
  }) as any;

  db.address.updateMany = (async (args: any) => {
    updatedAddressWhere = args.where;
    updatedAddressData = args.data;
    return { count: 2 };
  }) as any;

  const count = await claimGuestOrdersForUser("user_abc123", "Test@Example.COM");

  assert.equal(count, 2);
  assert.deepEqual(updatedOrderWhere, { id: { in: ["order_1", "order_2"] } });
  assert.deepEqual(updatedOrderData, { userId: "user_abc123" });
  assert.deepEqual(updatedAddressWhere, { id: { in: ["addr_1", "addr_2"] }, userId: null });
  assert.deepEqual(updatedAddressData, { userId: "user_abc123" });
});

test("claimGuestOrdersForUser returns 0 when no guest orders match", async (t) => {
  const originalOrderFindMany = db.order.findMany;
  t.after(() => {
    db.order.findMany = originalOrderFindMany;
  });

  db.order.findMany = (async () => []) as any;

  const count = await claimGuestOrdersForUser("user_123", "noorders@example.com");
  assert.equal(count, 0);
});

test("getGuestSessionOrders returns only orders with valid HMAC guest tokens", async (t) => {
  const originalOrderFindMany = db.order.findMany;
  t.after(() => {
    db.order.findMany = originalOrderFindMany;
  });

  const validOrderId = "order_valid_123";
  const validEmail = "shopper@example.com";
  const validToken = createGuestOrderToken(validOrderId, validEmail);
  const tamperedToken = "badtoken000000000000000000000000000000000000000000000000000000000";

  db.order.findMany = (async (args: any) => {
    return [
      {
        id: validOrderId,
        guestEmail: validEmail,
        total: 120,
        status: "CONFIRMED",
        items: [],
      },
      {
        id: "order_invalid_456",
        guestEmail: "another@example.com",
        total: 80,
        status: "CONFIRMED",
        items: [],
      },
    ];
  }) as any;

  const res = await getGuestSessionOrders([
    { orderId: validOrderId, guestToken: validToken },
    { orderId: "order_invalid_456", guestToken: tamperedToken },
  ]);

  assert.equal(res.orders.length, 1);
  assert.equal(res.orders[0].id, validOrderId);
});

test("lookupGuestOrder verifies order by suffix and email", async (t) => {
  const originalOrderFindFirst = db.order.findFirst;
  t.after(() => {
    db.order.findFirst = originalOrderFindFirst;
  });

  const mockOrder = {
    id: "clx1234567890abcdef",
    guestEmail: "guest@example.com",
    total: 350,
    status: "PAID",
    items: [],
  };

  db.order.findFirst = (async (args: any) => {
    assert.equal(args.where.guestEmail.equals, "guest@example.com");
    return mockOrder;
  }) as any;

  const res = await lookupGuestOrder("#90abcdef", "guest@example.com");

  assert.equal(res.success, true);
  assert.ok(res.order);
  assert.equal(res.order.id, mockOrder.id);
  assert.ok(res.guestToken);

  // Validate the generated token matches
  const expectedToken = createGuestOrderToken(mockOrder.id, "guest@example.com");
  assert.equal(res.guestToken, expectedToken);
});

test("lookupGuestOrder rejects invalid query parameters", async () => {
  const shortId = await lookupGuestOrder("12", "test@example.com");
  assert.equal(shortId.success, false);

  const badEmail = await lookupGuestOrder("#ABC12345", "notanemail");
  assert.equal(badEmail.success, false);
});
