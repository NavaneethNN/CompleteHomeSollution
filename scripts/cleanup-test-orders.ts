import "dotenv/config";
import { db } from "../lib/db";

interface CleanupOptions {
  ids?: string[];
  emails?: string[];
  beforeDate?: Date;
  status?: string;
  restoreStock: boolean;
  dryRun: boolean;
}

function parseArgs(): CleanupOptions {
  const args = process.argv.slice(2);
  const options: CleanupOptions = {
    restoreStock: true,
    dryRun: true,
  };

  for (const arg of args) {
    if (arg === "--execute") {
      options.dryRun = false;
    } else if (arg === "--no-restore-stock") {
      options.restoreStock = false;
    } else if (arg.startsWith("--ids=")) {
      options.ids = arg.slice(6).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith("--emails=")) {
      options.emails = arg.slice(9).split(",").map((s) => s.trim().replace(/[.,;]+$/, "")).filter(Boolean);
    } else if (arg.startsWith("--email=")) {
      options.emails = arg.slice(8).split(",").map((s) => s.trim().replace(/[.,;]+$/, "")).filter(Boolean);
    } else if (arg.startsWith("--before=")) {
      options.beforeDate = new Date(arg.slice(9).trim());
      if (isNaN(options.beforeDate.getTime())) {
        console.error("Invalid date format for --before. Use YYYY-MM-DD or ISO format.");
        process.exit(1);
      }
    } else if (arg.startsWith("--status=")) {
      options.status = arg.slice(9).trim().toUpperCase();
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log("=================================================");
  console.log("🧹 Complete Home Sollution — Test Order Cleanup");
  console.log("=================================================");
  console.log(`Mode:          ${options.dryRun ? "🔍 DRY-RUN (Preview only, no changes)" : "🚨 LIVE EXECUTION (Permanent Deletion)"}`);
  console.log(`Restore Stock: ${options.restoreStock ? "Yes (Inventory will be returned)" : "No"}`);
  if (options.ids?.length) console.log(`Filter IDs:    ${options.ids.join(", ")}`);
  if (options.emails?.length) console.log(`Filter Emails: ${options.emails.join(", ")}`);
  if (options.beforeDate) console.log(`Filter Before: ${options.beforeDate.toISOString()}`);
  if (options.status) console.log(`Filter Status: ${options.status}`);
  console.log("-------------------------------------------------");

  if (!options.ids?.length && !options.emails?.length && !options.beforeDate && !options.status) {
    console.error("❌ SAFETY ERROR: You must provide at least one filter criterion:");
    console.error("   --ids=order_id_1,order_id_2");
    console.error("   --emails=test1@example.com,test2@example.com");
    console.error("   --before=2026-11-01");
    console.error("   --status=PENDING");
    console.error("\nExample (Dry Run):");
    console.error("   npx tsx scripts/cleanup-test-orders.ts --email=nnnavaneeth171@gmail.com");
    console.error("\nExample (Execute):");
    console.error("   npx tsx scripts/cleanup-test-orders.ts --email=nnnavaneeth171@gmail.com --execute");
    process.exit(1);
  }

  // Build Prisma where clause
  const where: any = {};
  if (options.ids?.length) {
    where.id = { in: options.ids };
  }
  if (options.emails?.length) {
    where.OR = [
      ...options.emails.map((e) => ({ guestEmail: { equals: e, mode: "insensitive" } })),
      ...options.emails.map((e) => ({ user: { email: { equals: e, mode: "insensitive" } } })),
    ];
  }
  if (options.beforeDate) {
    where.createdAt = { ...(where.createdAt || {}), lt: options.beforeDate };
  }
  if (options.status) {
    where.status = options.status;
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, name: true } },
      address: { select: { id: true, name: true, line1: true, suburb: true, postcode: true, userId: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, stock: true } },
          productVariant: { select: { id: true, stock: true } },
        },
      },
    },
  });

  if (orders.length === 0) {
    console.log("No orders found matching the specified criteria.");
    return;
  }

  console.log(`Found ${orders.length} order(s) matching criteria:\n`);

  let grandTotal = 0;
  const addressIdsToCheck = new Set<string>();

  orders.forEach((o, index) => {
    grandTotal += o.total;
    if (o.addressId) addressIdsToCheck.add(o.addressId);
    const customer = o.user?.name || o.address?.name || "Guest";
    const email = o.user?.email || o.guestEmail || "No Email";
    console.log(`[${index + 1}] ID: ${o.id}`);
    console.log(`    Date:     ${o.createdAt.toISOString()}`);
    console.log(`    Customer: ${customer} (${email})`);
    console.log(`    Status:   ${o.status} | Total: $${o.total.toFixed(2)}`);
    console.log(`    Payment:  PayWay: ${o.paywayTransactionId || "None"} | Stripe: ${o.stripePaymentId || "None"}`);
    console.log(`    Items (${o.items.length}):`);
    o.items.forEach((item) => {
      const pName = item.product?.name || "Product";
      const vId = item.productVariantId ? ` (Variant: ${item.productVariantId})` : "";
      console.log(`      - ${item.quantity}x ${pName}${vId} @ $${item.unitPrice}`);
    });
    console.log("");
  });

  console.log(`Summary: ${orders.length} order(s), Total Value: $${grandTotal.toFixed(2)}`);

  if (options.dryRun) {
    console.log("\n-------------------------------------------------");
    console.log("ℹ️  This was a DRY-RUN. No changes were made to the database.");
    console.log("To permanently delete these orders, run again with --execute:");
    console.log(`npx tsx scripts/cleanup-test-orders.ts ${process.argv.slice(2).filter((a) => a !== "--execute").join(" ")} --execute`);
    return;
  }

  console.log("\n⚠️  EXECUTING PERMANENT DELETION IN TRANSACTION...");

  const orderIds = orders.map((o) => o.id);

  await db.$transaction(
    async (tx) => {
      // 1. Restore product stock if requested (aggregated in-memory for fast batch execution)
      if (options.restoreStock) {
        console.log("📦 Restoring product inventory...");
        const productIncrements = new Map<string, number>();
        const variantIncrements = new Map<string, number>();
        const couponDecrements = new Map<string, number>();

        for (const order of orders) {
          if (["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
            for (const item of order.items) {
              if (item.productVariantId) {
                variantIncrements.set(item.productVariantId, (variantIncrements.get(item.productVariantId) || 0) + item.quantity);
              } else if (item.productId) {
                productIncrements.set(item.productId, (productIncrements.get(item.productId) || 0) + item.quantity);
              }
            }
          }
          if (order.couponId && order.couponReserved) {
            couponDecrements.set(order.couponId, (couponDecrements.get(order.couponId) || 0) + 1);
          }
        }

        for (const [variantId, qty] of variantIncrements.entries()) {
          await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: { increment: qty } },
          });
        }
        for (const [productId, qty] of productIncrements.entries()) {
          await tx.product.update({
            where: { id: productId },
            data: { stock: { increment: qty } },
          });
        }
        for (const [couponId, count] of couponDecrements.entries()) {
          await tx.coupon.updateMany({
            where: { id: couponId, usageCount: { gte: count } },
            data: { usageCount: { decrement: count } },
          });
        }
        console.log(`📦 Restored inventory for ${productIncrements.size} product(s) and ${variantIncrements.size} variant(s)`);
      }

      // 2. Delete EmailJob records associated with these orders
      const deletedEmailJobs = await tx.emailJob.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      console.log(`✉️  Deleted ${deletedEmailJobs.count} EmailJob record(s)`);

      // 3. Delete UserCoupon records
      const deletedUserCoupons = await tx.userCoupon.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      console.log(`🎟️  Deleted ${deletedUserCoupons.count} UserCoupon record(s)`);

      // 4. Detach RaffleWinner records
      const updatedRaffles = await tx.raffleWinner.updateMany({
        where: { orderId: { in: orderIds } },
        data: { orderId: null },
      });
      if (updatedRaffles.count > 0) {
        console.log(`🎁 Detached ${updatedRaffles.count} RaffleWinner record(s)`);
      }

      // 5. Delete OrderItem records
      const deletedItems = await tx.orderItem.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      console.log(`🛍️  Deleted ${deletedItems.count} OrderItem record(s)`);

      // 6. Delete Order records
      const deletedOrders = await tx.order.deleteMany({
        where: { id: { in: orderIds } },
      });
      console.log(`🗑️  Deleted ${deletedOrders.count} Order record(s)`);

      // 7. Cleanup orphan guest addresses if any
      const deletedAddresses = await tx.address.deleteMany({
        where: {
          id: { in: Array.from(addressIdsToCheck) },
          userId: null,
          orders: { none: {} },
        },
      });
      if (deletedAddresses.count > 0) {
        console.log(`🏠 Cleaned up ${deletedAddresses.count} unused guest address record(s)`);
      }
    },
    { timeout: 60000, maxWait: 20000 }
  );

  console.log("\n✅ SUCCESS: Test orders cleaned up completely!");
}

main()
  .catch((err) => {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect?.().catch(() => {});
    process.exit(0);
  });
