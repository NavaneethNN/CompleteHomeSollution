import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

loadEnvConfig(process.cwd());

// Synthetic AUD prices and packed cm/kg estimates, not supplier measurements.
// Large sets use one consolidated freight envelope because the current schema
// stores one package per sellable unit, not multiple cartons.
type Profile = { price: number; weight: number; length: number; width: number; height: number };
const profile = (price: number, weight: number, length: number, width: number, height: number): Profile => ({ price, weight, length, width, height });
const basics: Record<string, Profile> = {
  "Curved Accent Chair": profile(379, 18, 80, 77, 75),
  "Entry Console Table": profile(269, 15, 128, 43, 20),
  "Ergonomic Office Chair": profile(449, 18, 75, 65, 40),
  "Executive Desk": profile(699, 48, 168, 83, 25),
  "Floating Nightstand": profile(189, 6, 50, 36, 18),
  "King Size Platform Bed": profile(899, 65, 215, 105, 35),
  "Modular Wardrobe System": profile(599, 62, 210, 65, 40),
  "Open Bookshelf": profile(429, 32, 188, 38, 22),
  "Scandinavian Coffee Table": profile(299, 20, 118, 68, 20),
  "Six-Seater Dining Set": profile(1499, 105, 188, 100, 95),
};

function choose(name: string, attributes: Record<string, string>): Profile {
  if (basics[name]) return { ...basics[name] };
  const size = attributes.size ?? attributes["bed size"] ?? "";
  if (name === "Luxury Velvet Sofa") {
    const premium = /emerald|burgundy/.test(attributes.color ?? "") ? 100 : 0;
    const p = size.startsWith("l-shape") ? profile(2199, 88, 290, 110, 110)
      : size.startsWith("3-seater") ? profile(1599, 58, 230, 100, 80)
      : size.startsWith("2-seater") ? profile(1299, 45, 190, 100, 80) : null;
    if (p) return { ...p, price: p.price + premium };
  }
  if (name === "Modern Extendable Dining Table") {
    const p = size.startsWith("4-seater") ? profile(799, 30, 130, 90, 22)
      : size.startsWith("6-seater") ? profile(999, 40, 170, 100, 24)
      : size.startsWith("8-seater") ? profile(1299, 52, 210, 105, 28) : null;
    if (p) {
      const material = attributes.material;
      return { ...p, price: p.price + (material === "walnut" ? 100 : material === "glass top" ? -100 : 0), weight: p.weight + (material === "glass top" ? 8 : 0) };
    }
  }
  if (name === "Complete Bedroom Set" && ["queen", "king"].includes(size)) {
    const p = size === "king" ? profile(1499, 115, 220, 115, 100) : profile(1299, 100, 215, 100, 100);
    return { ...p, price: p.price + (attributes.finish === "grey" ? 100 : 0) };
  }
  if (name === "Recliner Sofa") {
    if (size === "single") return profile(699, 38, 100, 95, 85);
    if (size === "double") return profile(1099, 72, 165, 100, 90);
  }
  throw new Error(`No reviewed test profile for ${name}: ${JSON.stringify(attributes)}`);
}

function values(p: Profile) {
  return { price: p.price, memberPrice: Math.round(p.price * 85) / 100, comparePrice: Math.round(p.price * 120) / 100,
    weight: p.weight, length: p.length, width: p.width, height: p.height };
}

async function main() {
  const { db } = await import("../lib/db");
  try {
    const products = await db.product.findMany({ orderBy: { name: "asc" }, include: {
      productVariants: { orderBy: { sku: "asc" }, include: { values: { include: { variantValue: { include: { variantAttribute: true } } } } } },
    } });
    if (!products.length) throw new Error("Catalog is empty; no updates made");
    const plan = products.map(product => {
      const variants = product.productVariants.map(variant => {
        const attributes = Object.fromEntries(variant.values.map(({ variantValue: value }) => [value.variantAttribute.name.toLowerCase(), value.value.toLowerCase()]));
        return { id: variant.id, sku: variant.sku, updatedAt: variant.updatedAt, data: values(choose(product.name, attributes)) };
      });
      const lowest = [...variants].sort((a, b) => a.data.price - b.data.price)[0];
      const { price, ...rest } = lowest?.data ?? values(choose(product.name, {}));
      return { id: product.id, name: product.name, updatedAt: product.updatedAt, data: { basePrice: price, ...rest }, variants };
    });
    console.table(plan.flatMap(p => [
      { item: p.name, AUD: p.data.basePrice, kg: p.data.weight, cm: `${p.data.length} x ${p.data.width} x ${p.data.height}` },
      ...p.variants.map(v => ({ item: v.sku, AUD: v.data.price, kg: v.data.weight, cm: `${v.data.length} x ${v.data.width} x ${v.data.height}` })),
    ]));
    const variantCount = plan.reduce((n, p) => n + p.variants.length, 0);
    if (!process.argv.includes("--apply")) {
      console.log(`Dry run: ${plan.length} products and ${variantCount} variants. Add --apply to update.`);
      return;
    }
    const previous = (row: { comparePrice: number | null; memberPrice: number | null; weight: number | null; length: number | null; width: number | null; height: number | null }) => ({
      comparePrice: row.comparePrice, memberPrice: row.memberPrice, weight: row.weight, length: row.length, width: row.width, height: row.height,
    });
    const backup = join(tmpdir(), `chs-test-catalog-before-${Date.now()}.json`);
    writeFileSync(backup, JSON.stringify({ createdAt: new Date().toISOString(), products: products.map(p => ({
      id: p.id, name: p.name, data: { basePrice: p.basePrice, ...previous(p) },
      variants: p.productVariants.map(v => ({ id: v.id, sku: v.sku, data: { price: v.price, ...previous(v) } })),
    })) }, null, 2), { mode: 0o600, flag: "wx" });
    console.log(`Previous values backed up to ${backup}`);
    await db.$transaction(async tx => {
      for (const p of plan) {
        const changed = await tx.product.updateMany({ where: { id: p.id, updatedAt: p.updatedAt }, data: p.data });
        if (changed.count !== 1) throw new Error(`Concurrent edit of ${p.name}; rolling back`);
        for (const v of p.variants) {
          const changedVariant = await tx.productVariant.updateMany({ where: { id: v.id, updatedAt: v.updatedAt }, data: v.data });
          if (changedVariant.count !== 1) throw new Error(`Concurrent edit of ${v.sku}; rolling back`);
        }
      }
      // Verify every written field before committing the transaction.
      for (const p of plan) {
        const saved = await tx.product.findUniqueOrThrow({ where: { id: p.id }, include: { productVariants: true } });
        for (const [key, value] of Object.entries(p.data)) {
          if (saved[key as keyof typeof p.data] !== value) throw new Error(`Verification failed: ${p.name}.${key}`);
        }
        for (const v of p.variants) {
          const savedVariant = saved.productVariants.find(item => item.id === v.id);
          for (const [key, value] of Object.entries(v.data)) {
            if (savedVariant?.[key as keyof typeof v.data] !== value) throw new Error(`Verification failed: ${v.sku}.${key}`);
          }
        }
      }
    }, { timeout: 120000 });
    console.log(`Committed and verified ${plan.length} products and ${variantCount} variants. Prices AUD; dimensions cm; weights kg.`);
  } finally { await db.$disconnect(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Seed failed"); process.exitCode = 1; });
