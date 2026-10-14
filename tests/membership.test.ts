import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import type { Prisma } from "@prisma/client";
import { activateMembershipInTransaction, hasActiveMembership, refundOrderMembership, enforceExpiry } from "../lib/membership";

test("active membership uses one exact expiry boundary", () => {
  const now = new Date("2026-09-24T00:00:00.000Z");
  assert.equal(hasActiveMembership({ isMember: true, membershipExpiry: null }, now), true);
  assert.equal(hasActiveMembership({ isMember: true, membershipExpiry: new Date(now.getTime() + 1) }, now), true);
  assert.equal(hasActiveMembership({ isMember: true, membershipExpiry: now }, now), false);
  assert.equal(hasActiveMembership({ isMember: true, membershipExpiry: new Date(now.getTime() - 1) }, now), false);
  assert.equal(hasActiveMembership({ isMember: false, membershipExpiry: new Date(now.getTime() + 1) }, now), false);
});

function transaction() {
  const state = { isMember: false, memberSince: null as Date | null, membershipExpiry: null as Date | null };
  const payments: Record<string, unknown>[] = [];
  const operations: string[] = [];
  const tx = {
    $queryRaw: async () => { operations.push("lock"); return []; },
    membershipPlan: { findUnique: async () => ({ id: "plan", durationDays: 999 }), findFirst: async () => null },
    user: {
      findUnique: async () => ({ ...state }),
      update: async ({ data }: { data: typeof state }) => { operations.push("activate"); Object.assign(state, data); },
      updateMany: async ({ where, data }: { where: { membershipExpiry: Date }; data: Partial<typeof state> }) => {
        if (state.membershipExpiry?.getTime() !== where.membershipExpiry.getTime()) return { count: 0 };
        Object.assign(state, data); return { count: 1 };
      },
    },
    membershipPayment: {
      findFirst: async ({ where }: { where: { OR: { paywaySessionId?: string }[] } }) => payments.find(p => p.paywaySessionId === where.OR[0].paywaySessionId) ?? null,
      findMany: async ({ where }: { where: { id: { not: string } } }) => payments.filter(p => p.id !== where.id.not && !p.refundedAt).map(p => ({ ...p })),
      findUnique: async ({ where }: { where: { paywaySessionId: string } }) => payments.find(p => p.paywaySessionId === where.paywaySessionId) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => { operations.push("record"); payments.push({ id: String(payments.length), createdAt: new Date(), ...data }); },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(payments.find(p => p.id === where.id)!, data),
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, state, payments, operations };
}
const purchase = { userId: "user", planId: "plan", durationDays: 30, amountPaid: 30, paywaySessionId: "order:order1:membership" };

test("activation uses purchased duration and records one entitlement on duplicate delivery", async () => {
  const { tx, state, payments, operations } = transaction();
  const before = Date.now();
  assert.equal((await activateMembershipInTransaction(tx, purchase)).activated, true);
  const expiry = state.membershipExpiry!.getTime();
  assert.ok(expiry >= before + 30 * 86400000 && expiry < Date.now() + 30 * 86400000 + 1000);
  assert.equal((await activateMembershipInTransaction(tx, purchase)).alreadyProcessed, true);
  assert.equal(payments.length, 1);
  assert.equal(state.membershipExpiry!.getTime(), expiry);
  assert.deepEqual(operations, ["lock", "activate", "record", "lock"]);
});

test("renewal extends existing expiry and a full refund restores the previous entitlement", async () => {
  const { tx, state, payments } = transaction();
  const previous = new Date(Date.now() + 10 * 86400000);
  state.membershipExpiry = previous; state.isMember = true;
  await activateMembershipInTransaction(tx, purchase);
  assert.equal(state.membershipExpiry!.getTime(), previous.getTime() + 30 * 86400000);
  await refundOrderMembership(tx, "order1");
  assert.equal(state.membershipExpiry!.getTime(), previous.getTime());
  assert.equal(state.isMember, true);
  assert.ok(payments[0].refundedAt);
  await refundOrderMembership(tx, "order1");
  assert.equal(state.membershipExpiry!.getTime(), previous.getTime());
});

test("full refund revokes a first membership but preserves an unrelated admin grant", async () => {
  const first = transaction();
  await activateMembershipInTransaction(first.tx, purchase);
  await refundOrderMembership(first.tx, "order1");
  assert.equal(first.state.isMember, false);
  assert.equal(first.state.membershipExpiry, null);
  const granted = transaction();
  await activateMembershipInTransaction(granted.tx, purchase);
  const adminExpiry = new Date(Date.now() + 365 * 86400000);
  granted.state.membershipExpiry = adminExpiry;
  await refundOrderMembership(granted.tx, "order1");
  assert.equal(granted.state.membershipExpiry, adminExpiry);
});

test("zero-cost recorded activations remain idempotent", async () => {
  const { tx, payments } = transaction();
  await activateMembershipInTransaction(tx, { ...purchase, amountPaid: 0 });
  assert.equal((await activateMembershipInTransaction(tx, { ...purchase, amountPaid: 0 })).alreadyProcessed, true);
  assert.equal(payments.length, 1);
});


test("refunding an earlier membership removes its time while preserving a subsequent paid renewal", async () => {
  const { tx, state, payments } = transaction();
  await activateMembershipInTransaction(tx, purchase);
  await activateMembershipInTransaction(tx, { ...purchase, paywaySessionId: "order:order2:membership" });
  const previousExpiry = state.membershipExpiry!.getTime();
  await refundOrderMembership(tx, "order1");
  assert.ok(state.isMember);
  assert.ok(state.membershipExpiry!.getTime() <= previousExpiry - 30 * 86400000 + 1000);
  assert.equal(payments[1].refundedAt, undefined);
  await refundOrderMembership(tx, "order2");
  assert.equal(state.isMember, false);
});


test("expiry enforcement uses an atomic inclusive boundary and preserves the expiry date", async t => {
  const now = new Date("2026-10-14T00:00:00Z");
  t.mock.timers.enable({ apis: ["Date"], now });
  let changed = 1;
  const original = db.user.updateMany;
  t.after(() => { db.user.updateMany = original; });
  db.user.updateMany = (async ({ where, data }: Prisma.UserUpdateManyArgs) => {
    assert.deepEqual(where, { id: "user", isMember: true, membershipExpiry: { lte: now } });
    assert.deepEqual(data, { isMember: false });
    return { count: changed };
  }) as unknown as typeof db.user.updateMany;
  assert.equal(await enforceExpiry("user"), true);
  changed = 0;
  assert.equal(await enforceExpiry("user"), false);
});

test("lapsed and revoked memberships start a fresh paid duration", async () => {
  for (const isMember of [true, false]) {
    const { tx, state, payments } = transaction();
    state.isMember = isMember;
    state.membershipExpiry = new Date(Date.now() + (isMember ? -10 : 10) * 86400000);
    const before = Date.now();
    await activateMembershipInTransaction(tx, purchase);
    assert.ok(state.membershipExpiry!.getTime() >= before + 30 * 86400000);
    assert.ok(state.membershipExpiry!.getTime() <= Date.now() + 30 * 86400000);
    if (!isMember) assert.equal(payments[0].previousExpiry, null);
  }
});

test("invalid purchased durations do not activate membership", async () => {
  for (const durationDays of [0, -1, 1.5, NaN]) {
    const { tx, state, payments } = transaction();
    await assert.rejects(activateMembershipInTransaction(tx, { ...purchase, durationDays }), /Invalid membership duration/);
    assert.equal(state.isMember, false);
    assert.equal(payments.length, 0);
  }
});
