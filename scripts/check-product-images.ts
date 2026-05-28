import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const products = await db.product.findMany({
    select: { id: true, name: true, slug: true, images: true },
  });

  for (const p of products) {
    const imgs = p.images as string[];
    console.log(`\n[${p.slug}] "${p.name}" — ${imgs.length} image(s)`);
    imgs.forEach((url, i) => {
      const preview = url.startsWith("data:") ? url.slice(0, 50) + "... (BASE64)" : url;
      console.log(`  [${i}] ${preview}`);
    });
  }

  await db.$disconnect();
}

main().catch(console.error);
