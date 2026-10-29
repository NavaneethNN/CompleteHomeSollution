import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveMemberPrice } from "@/lib/member-price";

const schema = z.object({ ids: z.array(z.string().cuid()).min(1).max(50) });
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const { ids } = schema.parse(await req.json());
    const products = await db.product.findMany({
      where: { id: { in: [...new Set(ids)] }, isActive: true },
      select: { id: true, name: true, slug: true, sku: true, images: true, hasVariants: true, basePrice: true, memberPrice: true, stock: true, weight: true,
        productVariants: { where: { isActive: true }, select: { id: true, sku: true, price: true, memberPrice: true, stock: true, weight: true,
          images: { select: { url: true }, orderBy: { displayOrder: "asc" } },
          values: { select: { variantValue: { select: { value: true, variantAttribute: { select: { name: true } } } } } } } } },
    });
    const prices: Record<string, { price: number; memberPrice: number | null; stock: number; weight: number }> = {};
    const catalog: Record<string, { id: string; name: string; slug: string; sku: string; images: string[]; price: number; memberPrice: number | null; stock: number; variantId?: string; variantLabel?: string }> = {};
    for (const product of products) {
      if (!product.hasVariants) {
        const memberPrice = resolveMemberPrice(product.basePrice, product.memberPrice);
        prices[product.id] = { price: product.basePrice, memberPrice, stock: product.stock, weight: product.weight ?? 2 };
        catalog[product.id] = { id: product.id, name: product.name, slug: product.slug, sku: product.sku, images: product.images, price: product.basePrice, memberPrice, stock: product.stock };
      }
      for (const variant of product.productVariants) {
        const memberPrice = resolveMemberPrice(variant.price, variant.memberPrice, product.memberPrice);
        const variantImages = variant.images?.length > 0 ? variant.images.map(img => img.url) : product.images;
        prices[variant.id] = { price: variant.price, memberPrice, stock: variant.stock, weight: variant.weight ?? product.weight ?? 2 };
        catalog[variant.id] = { id: product.id, name: product.name, slug: product.slug, sku: variant.sku, images: variantImages, price: variant.price, memberPrice, stock: variant.stock, variantId: variant.id,
          variantLabel: variant.values.map(value => `${value.variantValue.variantAttribute.name}: ${value.variantValue.value}`).join(" · ") };
      }
    }
    return NextResponse.json({ prices, catalog });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
    console.error("[cart products]", error);
    return NextResponse.json({ error: "Could not refresh cart prices" }, { status: 503 });
  }
}
