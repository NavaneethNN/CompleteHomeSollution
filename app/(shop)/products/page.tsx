import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { ProductCard } from "@/components/shop/product-card";
import { CategoryFilter } from "@/components/shop/category-filter";

export const metadata: Metadata = {
  title: "All Products — Complete Home Sollution",
  description: "Browse our premium furniture collection. Sofas, beds, dining sets, office furniture and more with Australia-wide delivery.",
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
    roomType: p.roomType,
    hasVariants: p.hasVariants,
    category: p.category,
    reviewCount: p._count.reviews,
    // If has variants, use first variant's price and image
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
      {/* Hero Banner */}
      <section className="bg-navy py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">All Products</h1>
          <p className="text-white/70 max-w-2xl">
            Discover our curated collection of premium furniture. Each piece is crafted with care 
            to transform your home into a beautiful living space.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-64 shrink-0">
            <Suspense fallback={<div className="h-48 bg-muted rounded-xl animate-pulse" />}>
              <CategoryFilter categories={categories} />
            </Suspense>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{products.length}</span> products
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
