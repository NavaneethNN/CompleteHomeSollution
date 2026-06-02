import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const excludeIds = searchParams.get("exclude")?.split(",").filter(Boolean) || [];
    const limit = parseInt(searchParams.get("limit") || "3", 10);
    const basedOnIds = searchParams.get("basedOn")?.split(",").filter(Boolean) || [];

    // If we have products to base recommendations on, try to find similar ones
    // Otherwise, return trending/popular products
    let products;

    if (basedOnIds.length > 0) {
      // Get categories of the products in cart
      const cartProducts = await db.product.findMany({
        where: { id: { in: basedOnIds } },
        select: { categoryId: true },
      });
      
      const categoryIds = [...new Set(cartProducts.map(p => p.categoryId).filter(Boolean))];
      
      // Find products from the same categories or complementary categories
      products = await db.product.findMany({
        where: {
          id: { notIn: excludeIds },
          isActive: true,
          OR: [
            { categoryId: { in: categoryIds } },
            // Cross-category recommendations (e.g., if buying furniture, suggest accessories)
            categoryIds.length > 0 ? { category: { slug: { in: ["accessories", "decor", "lighting"] } } } : {},
          ],
        },
        include: {
          category: { select: { name: true } },
          productVariants: {
            where: { isActive: true },
            orderBy: { price: "asc" },
            take: 1,
            select: { price: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }

    // If no products found, fall back to best sellers
    if (!products || products.length === 0) {
      products = await db.product.findMany({
        where: {
          id: { notIn: excludeIds },
          isActive: true,
        },
        include: {
          category: { select: { name: true } },
          productVariants: {
            where: { isActive: true },
            orderBy: { price: "asc" },
            take: 1,
            select: { price: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }

    // Format products - eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedProducts = (products as any[]).map((product) => {
      const price = product.productVariants?.[0]?.price ?? product.basePrice;
      
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price,
        memberPrice: product.memberPrice,
        images: product.images,
        category: product.category?.name || "General",
        tag: "Popular",
      };
    });

    return NextResponse.json({ products: formattedProducts });
  } catch (error) {
    console.error("[GET /api/products/upsells]", error);
    return NextResponse.json(
      { error: "Failed to fetch upsell products" },
      { status: 500 }
    );
  }
}
