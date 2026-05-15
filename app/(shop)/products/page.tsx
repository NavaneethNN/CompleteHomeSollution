import type { Metadata } from "next";
import { db } from "@/lib/db";
import { ProductsClient } from "@/components/shop/products-client";
import { fallbackCategories, fallbackProducts } from "@/lib/data/fallback-shop-data";

export const metadata: Metadata = {
  title: "All Products — Complete Home Sollution",
  description: "Browse our premium furniture collection. Sofas, beds, dining sets, office furniture and more.",
};

export const revalidate = 3600;

async function getProducts() {
  try {
    const products = await db.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { name: true, slug: true } },
        productVariants: {
          where: { isActive: true },
          include: { images: { take: 1, orderBy: { displayOrder: "asc" } } },
          orderBy: { price: "asc" },
          take: 1,
        },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (products.length === 0) {
      return fallbackProducts;
    }

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      basePrice: p.basePrice,
      comparePrice: p.comparePrice,
      memberPrice: p.memberPrice,
      stock: p.stock,
      images: p.images,
      material: p.material,
      hasVariants: p.hasVariants,
      category: p.category,
      reviewCount: p._count.reviews,
      variant: p.hasVariants && p.productVariants[0] ? {
        id: p.productVariants[0].id,
        price: p.productVariants[0].price,
        comparePrice: p.productVariants[0].comparePrice,
        memberPrice: p.productVariants[0].memberPrice,
        stock: p.productVariants[0].stock,
        image: p.productVariants[0].images[0]?.url,
      } : null,
    }));
  } catch {
    return fallbackProducts;
  }
}

async function getCategories() {
  try {
    const categories = await db.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });

    return categories.length > 0 ? categories : fallbackCategories;
  } catch {
    return fallbackCategories;
  }
}

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <main className="min-h-screen bg-background">
      {/* Products with Client-side Filtering */}
      <div className="container mx-auto px-4 py-6">
        <ProductsClient categories={categories} products={products} />
      </div>
    </main>
  );
}
