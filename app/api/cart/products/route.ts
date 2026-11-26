import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveMemberPrice } from "@/lib/member-price";
import { isLargeProduct } from "@/lib/manual-delivery";
import {
  expandCourierProductVariantsForLargeCheck,
  resolveCourierPackageSet,
} from "@/lib/variant-dimensions";
import { cacheGet, cacheSet } from "@/lib/redis";

const schema = z.object({ ids: z.array(z.string().cuid()).min(1).max(50) });
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const { ids } = schema.parse(await req.json());
    const uniqueSortedIds = [...new Set(ids)].sort();
    const cacheKey = `cart:catalog:v2:${uniqueSortedIds.join(",")}`;

    const cached = await cacheGet<{ prices: Record<string, unknown>; catalog: Record<string, unknown> }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const products = await db.product.findMany({
      where: { id: { in: uniqueSortedIds }, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        sku: true,
        images: true,
        hasVariants: true,
        isLargeItem: true,
        memberFreeDelivery: true,
        memberDeliveryCharge: true,
        basePrice: true,
        memberPrice: true,
        stock: true,
        weight: true,
        length: true,
        width: true,
        height: true,
        extraPackages: true,
        category: { select: { slug: true, name: true } },
        productVariants: {
          where: { isActive: true },
          select: {
            id: true,
            sku: true,
            price: true,
            memberPrice: true,
            stock: true,
            weight: true,
            length: true,
            width: true,
            height: true,
            extraPackages: true,
            images: { select: { url: true }, orderBy: { displayOrder: "asc" } },
            values: { select: { variantValue: { select: { value: true, variantAttribute: { select: { name: true } } } } } },
          },
        },
      },
    });
    const prices: Record<
      string,
      {
        price: number;
        memberPrice: number | null;
        stock: number;
        weight: number;
        length: number | null;
        width: number | null;
        height: number | null;
        isLargeItem: boolean;
        memberFreeDelivery: boolean;
        memberDeliveryCharge: number | null;
      }
    > = {};
    const catalog: Record<
      string,
      {
        id: string;
        name: string;
        slug: string;
        sku: string;
        images: string[];
        price: number;
        memberPrice: number | null;
        stock: number;
        variantId?: string;
        variantLabel?: string;
        isLargeItem: boolean;
        memberFreeDelivery: boolean;
        memberDeliveryCharge: number | null;
      }
    > = {};
    for (const product of products) {
      if (!product.hasVariants) {
        const memberPrice = resolveMemberPrice(product.basePrice, product.memberPrice);
        const productPkg = resolveCourierPackageSet(product, null);
        const largeFlag = expandCourierProductVariantsForLargeCheck(product, null).some(isLargeProduct);
        prices[product.id] = {
          price: product.basePrice,
          memberPrice,
          stock: product.stock,
          weight: productPkg.weight ?? 2,
          length: productPkg.length,
          width: productPkg.width,
          height: productPkg.height,
          isLargeItem: largeFlag,
          memberFreeDelivery: Boolean(product.memberFreeDelivery),
          memberDeliveryCharge: product.memberDeliveryCharge ?? null,
        };
        catalog[product.id] = {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          images: product.images,
          price: product.basePrice,
          memberPrice,
          stock: product.stock,
          isLargeItem: largeFlag,
          memberFreeDelivery: Boolean(product.memberFreeDelivery),
          memberDeliveryCharge: product.memberDeliveryCharge ?? null,
        };
      }
      for (const variant of product.productVariants) {
        const memberPrice = resolveMemberPrice(variant.price, variant.memberPrice, product.memberPrice);
        const variantImages = variant.images?.length > 0 ? variant.images.map(img => img.url) : product.images;
        const variantPkg = resolveCourierPackageSet(product, variant);
        const variantLargeFlag = expandCourierProductVariantsForLargeCheck(product, variant).some(isLargeProduct);
        prices[variant.id] = {
          price: variant.price,
          memberPrice,
          stock: variant.stock,
          weight: variantPkg.weight ?? product.weight ?? 2,
          length: variantPkg.length,
          width: variantPkg.width,
          height: variantPkg.height,
          isLargeItem: variantLargeFlag,
          memberFreeDelivery: Boolean(product.memberFreeDelivery),
          memberDeliveryCharge: product.memberDeliveryCharge ?? null,
        };
        catalog[variant.id] = {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: variant.sku,
          images: variantImages,
          price: variant.price,
          memberPrice,
          stock: variant.stock,
          variantId: variant.id,
          variantLabel: variant.values.map(value => `${value.variantValue.variantAttribute.name}: ${value.variantValue.value}`).join(" · "),
          isLargeItem: variantLargeFlag,
          memberFreeDelivery: Boolean(product.memberFreeDelivery),
          memberDeliveryCharge: product.memberDeliveryCharge ?? null,
        };
      }
    }

    await cacheSet(cacheKey, { prices, catalog }, 30).catch(() => {});

    return NextResponse.json({ prices, catalog });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
    console.error("[cart products]", error);
    return NextResponse.json({ error: "Could not refresh cart prices" }, { status: 503 });
  }
}
