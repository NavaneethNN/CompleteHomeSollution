import { config } from "dotenv";
config({ quiet: true });
config({ path: ".env.local", override: true, quiet: true });

async function main() {
  const { db } = await import("../lib/db");
  const { checkDatabaseReadiness } = await import("../lib/database-readiness");
  try {
    // Read every scalar column, just as checkout and settlement do. A partial
    // select previously hid missing membership snapshot/refund migrations.
    await checkDatabaseReadiness();
    console.log("PASS: runtime Prisma client can read checkout, refund, membership, coupon and notification columns");
    const gateway = process.env.PAYMENT_GATEWAY ?? process.env.NEXT_PUBLIC_PAYMENT_GATEWAY ?? "payway";
    const required = gateway === "onlinepay"
      ? ["ONLINEPAY_USER_UID", "ONLINEPAY_API_KEY", "ONLINEPAY_ENTITY_ID", "ONLINEPAY_PPC_ID", "ONLINEPAY_3DS_ID", "ONLINEPAY_WEBHOOK_SECRET", "NEXT_PUBLIC_APP_URL"]
      : ["PAYWAY_SECRET_KEY", "PAYWAY_MERCHANT_ID", "NEXT_PUBLIC_PAYWAY_PUBLISHABLE_KEY"];
    console.log(`Gateway: ${gateway}; mode: ${gateway === "onlinepay" ? process.env.ONLINEPAY_MODE ?? "test" : "merchant-configured"}`);
    const missing = required.filter((key) => !process.env[key]);
    console.log(missing.length ? `Missing configuration: ${missing.join(", ")}` : "PASS: required gateway settings are present (values withheld)");
    if (missing.length) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Checkout check failed");
  console.error("Check database migrations: run npm run db:deploy, then rerun this check.");
  process.exitCode = 1;
});
