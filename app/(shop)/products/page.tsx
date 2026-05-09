import type { Metadata } from "next";
import { db } from "@/lib/db";
import { ProductsClient } from "@/components/shop/products-client";

export const metadata: Metadata = {
  title: "All Products — Complete Home Sollution",
  description: "Browse our premium furniture collection. Sofas, beds, dining sets, office furniture and more.",
};

export const revalidate = 3600;

async function getProducts() {
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
}

async function getCategories() {
  return db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <main className="min-h-screen bg-background">
      {/* Minimal Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-xl font-semibold text-foreground">All Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {products.length} products available
          </p>
        </div>
      </div>

      {/* Products with Client-side Filtering */}
      <div className="container mx-auto px-4 py-6">
        <ProductsClient categories={categories} products={products} />
      </div>
    </main>
  );
}
