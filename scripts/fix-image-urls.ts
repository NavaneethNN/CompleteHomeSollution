/**
 * Patches all category and product image URLs in the DB,
 * replacing the old domain with the new R2 public URL.
 *
 * Run with:  npx tsx scripts/fix-image-urls.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const OLD_DOMAIN = "https://completehomesolution.com.au";
const NEW_BASE = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");

if (!NEW_BASE) {
  console.error("R2_PUBLIC_URL is not set in .env / .env.local");
  process.exit(1);
}

function replaceUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith(OLD_DOMAIN)) {
    return NEW_BASE + url.slice(OLD_DOMAIN.length);
  }
  return url;
}

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  // ── Fix category images ──────────────────────────────────────────
  const categories = await db.category.findMany({
    where: { image: { startsWith: OLD_DOMAIN } },
  });

  console.log(`Found ${categories.length} category image(s) to fix.`);
  for (const cat of categories) {
    const newImage = replaceUrl(cat.image);
    await db.category.update({ where: { id: cat.id }, data: { image: newImage } });
    console.log(`  ✓ Category "${cat.name}": ${cat.image} → ${newImage}`);
  }

  // ── Fix product images (array field) ────────────────────────────
  const products = await db.product.findMany({
    select: { id: true, name: true, images: true },
  });

  let productFixed = 0;
  for (const product of products) {
    const oldImages = product.images as string[];
    const newImages = oldImages.map((url) => replaceUrl(url) ?? url);
    const changed = oldImages.some((url, i) => url !== newImages[i]);
    if (changed) {
      await db.product.update({ where: { id: product.id }, data: { images: newImages } });
      console.log(`  ✓ Product "${product.name}" images updated.`);
      productFixed++;
    }
  }
  console.log(`Fixed ${productFixed} product image(s).`);

  await db.$disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
