import { config } from "dotenv";
import assert from "node:assert/strict";
config({ quiet: true });
config({ path: ".env.local", override: true, quiet: true });

async function main() {
  const { db } = await import("../lib/db");
  const { assertInventoryAvailableForPendingOrder, InventoryUnavailableError } = await import("../lib/inventory-reservation");
  const rollback = new Error("ROLLBACK_CHECKOUT_SMOKE_TEST");
  let testOrderId: string | undefined;
  try {
    try {
      await db.$transaction(async (tx) => {
        const product = await tx.product.findFirst({ where: { stock: { gt: 0 }, isActive: true }, select: { id: true, stock: true } });
        assert.ok(product, "An active stocked product is needed for this test");
        const address = await tx.address.create({ data: { name: "Integration Test", phone: "0400000000", line1: "1 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000", country: "AU" } });
        const order = await tx.order.create({ data: { addressId: address.id, guestEmail: "test@example.com", subtotal: 1, shippingCost: 0, tax: 0.1, total: 1.1, idempotencyKey: crypto.randomUUID(), items: { create: { productId: product.id, quantity: 1, unitPrice: 1 } } }, include: { items: true } });
        testOrderId = order.id;
        await assert.rejects(
          () => assertInventoryAvailableForPendingOrder(tx, [{ productId: product.id, quantity: product.stock }]),
          InventoryUnavailableError,
        );
        for (let attempt = 0; attempt < 2; attempt++) {
          const claimed = await tx.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "PAID" } });
          assert.equal(claimed.count, attempt === 0 ? 1 : 0);
          if (claimed.count) await tx.product.updateMany({ where: { id: product.id, stock: { gte: 1 } }, data: { stock: { decrement: 1 } } });
        }
        const updated = await tx.product.findUniqueOrThrow({ where: { id: product.id }, select: { stock: true } });
        assert.equal(updated.stock, product.stock - 1);
        const firstRefund = await tx.order.updateMany({ where: { id: order.id, refundProcessing: false }, data: { refundProcessing: true } });
        const repeatedRefund = await tx.order.updateMany({ where: { id: order.id, refundProcessing: false }, data: { refundProcessing: true } });
        assert.equal(firstRefund.count, 1);
        assert.equal(repeatedRefund.count, 0);
        throw rollback;
      }, { timeout: 30000, maxWait: 10000 });
    } catch (error) { if (error !== rollback) throw error; }
    assert.ok(testOrderId);
    assert.equal(await db.order.count({ where: { id: testOrderId } }), 0);
    console.log("PASS: pending stock hold, repeated settlement claim, one stock decrement, and refund claim; all test writes rolled back");
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Transaction test failed"); process.exitCode = 1; });
