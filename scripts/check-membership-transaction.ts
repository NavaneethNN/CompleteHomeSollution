import { config } from "dotenv";
import assert from "node:assert/strict";
config({ quiet: true });
config({ path: ".env.local", override: true, quiet: true });

async function main() {
  const { db } = await import("../lib/db");
  const { activateMembershipInTransaction, refundOrderMembership } = await import("../lib/membership");
  const rollback = new Error("ROLLBACK_MEMBERSHIP_CHECK");
  let userId: string | undefined;
  let orderId: string | undefined;
  try {
    try {
      await db.$transaction(async (tx) => {
        const plan = await tx.membershipPlan.findFirstOrThrow({ where: { isActive: true, price: { gt: 0 } } });
        const user = await tx.user.create({ data: { name: "Membership integration check" } });
        userId = user.id;
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
        assert.equal(await tx.order.findFirst({ where: { userId, status: "PENDING", membershipAmount: { gt: 0 } } }), null);
        const amount = Math.round(plan.price * 100) / 100;
        const order = await tx.order.create({ data: {
          user: { connect: { id: user.id } }, subtotal: 0, shippingCost: 0, tax: 0, total: amount,
          membershipPlanId: plan.id, membershipDurationDays: plan.durationDays, membershipAmount: amount,
          address: { create: { name: "Integration Test", phone: "0400000000", line1: "1 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000", country: "AU" } },
        } });
        orderId = order.id;
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
        const purchase = { userId, planId: order.membershipPlanId, durationDays: order.membershipDurationDays!, amountPaid: amount, paywaySessionId: `order:${order.id}:membership` };
        assert.equal((await activateMembershipInTransaction(tx, purchase)).activated, true);
        const activated = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(activated.isMember, true);
        assert.ok(activated.membershipExpiry && activated.membershipExpiry > new Date());
        assert.equal((await activateMembershipInTransaction(tx, purchase)).alreadyProcessed, true);
        assert.equal(await tx.membershipPayment.count({ where: { userId } }), 1);
        await refundOrderMembership(tx, order.id);
        const refunded = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(refunded.isMember, false);
        assert.equal(refunded.membershipExpiry, null);
        const payment = await tx.membershipPayment.findFirstOrThrow({ where: { userId } });
        assert.ok(payment.refundedAt);
        throw rollback;
      }, { timeout: 60000, maxWait: 10000 });
    } catch (error) { if (error !== rollback) throw error; }
    assert.ok(userId && orderId);
    assert.equal(await db.user.count({ where: { id: userId } }), 0);
    assert.equal(await db.order.count({ where: { id: orderId } }), 0);
    console.log("PASS: membership order creation, activation, duplicate protection and refund; all test writes rolled back (no payment taken)");
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Membership check failed"); process.exitCode = 1; });
