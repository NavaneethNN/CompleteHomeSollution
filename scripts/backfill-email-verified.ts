/**
 * One-off script: backfill emailVerified for Google OAuth users that have NULL.
 * Run once: npx tsx scripts/backfill-email-verified.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  // Find all users with emailVerified=NULL who have a Google OAuth account
  const users = await db.user.findMany({
    where: {
      emailVerified: null,
      accounts: {
        some: { provider: "google" },
      },
    },
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log("No users need backfilling. All done.");
    return;
  }

  console.log(`Found ${users.length} Google OAuth user(s) with emailVerified=NULL. Patching...`);

  const now = new Date();
  const result = await db.user.updateMany({
    where: {
      id: { in: users.map((u) => u.id) },
    },
    data: { emailVerified: now },
  });

  console.log(`✓ Updated ${result.count} user(s):`);
  users.forEach((u) => console.log(`  - ${u.email ?? u.id}`));
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
