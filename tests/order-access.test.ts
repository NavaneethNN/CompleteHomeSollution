import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGuestOrderToken,
  createOrderReturnToken,
  verifyGuestOrderToken,
  verifyOrderReturnToken,
} from "../lib/order-access";

test("guest access is bound to an order and email, not knowledge of the email alone", (t) => {
  const old = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret-for-order-access";
  t.after(() => { if (old === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = old; });
  const token = createGuestOrderToken("order1", "Buyer@example.com");
  assert.equal(verifyGuestOrderToken("order1", "buyer@example.com", token), true);
  assert.equal(verifyGuestOrderToken("order2", "buyer@example.com", token), false);
  assert.equal(verifyGuestOrderToken("order1", "other@example.com", token), false);
  assert.equal(verifyGuestOrderToken("order1", "buyer@example.com", "buyer@example.com"), false);
  assert.equal(verifyGuestOrderToken("order1", "buyer@example.com", token.slice(1)), false);
});

test("payment return token is scoped to one order and expires", (t) => {
  const old = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret-for-order-return";
  t.after(() => { if (old === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = old; });

  const now = Date.UTC(2026, 8, 19, 12, 0, 0);
  const token = createOrderReturnToken("order1", now);

  assert.equal(verifyOrderReturnToken("order1", token, now), true);
  assert.equal(verifyOrderReturnToken("order2", token, now), false);
  assert.equal(verifyOrderReturnToken("order1", token.replace(/[a-f0-9]$/, "0"), now), false);
  assert.equal(verifyOrderReturnToken("order1", token, now + 24 * 60 * 60 * 1000), false);
});

test("payment return token is rejected when no signing secret is configured", (t) => {
  const oldAuth = process.env.AUTH_SECRET;
  const oldNextAuth = process.env.NEXTAUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret-for-order-return";
  delete process.env.NEXTAUTH_SECRET;
  const token = createOrderReturnToken("order1", 1_800_000_000_000);
  delete process.env.AUTH_SECRET;
  t.after(() => {
    if (oldAuth === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = oldAuth;
    if (oldNextAuth === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = oldNextAuth;
  });

  assert.equal(verifyOrderReturnToken("order1", token, 1_800_000_000_000), false);
  assert.equal(verifyOrderReturnToken("order1", "not-a-token", 1_800_000_000_000), false);
});
