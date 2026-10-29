import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ProductsClient } from "@/components/shop/products-client";
import { hasActiveMembership } from "@/lib/membership";
import { cacheFetch, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";

export const metadata: Metadata = {
  title: "All Products — Complete Home Sollution",
  description: "Browse our premium furniture collection. Sofas, beds, dining sets, office furniture and more.",
};

export const revalidate = 3600;

async function getProducts() {
  try {
    return await cacheFetch(
      CACHE_KEYS.productsAll,
      CACHE_TTL.productsAll,
      async () => {
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
          isPreOrder: p.isPreOrder ?? false,
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
    );
  } catch (error) {
    console.error("[products] Unable to load catalog", error);
    throw new Error("The catalog is temporarily unavailable.");
  }
}

async function getCategories() {
  try {
    return await cacheFetch(
      CACHE_KEYS.categories,
      CACHE_TTL.categories,
      async () => {
        return db.category.findMany({
          include: { _count: { select: { products: true } } },
          orderBy: { name: "asc" },
        });
      }
    );
  } catch (error) {
    console.error("[categories] Unable to load catalog", error);
    throw new Error("The catalog is temporarily unavailable.");
  }
}

async function getMemberStatus(userId?: string) {
  if (!userId) return false;
  try {
    const membership = await db.user.findUnique({
      where: { id: userId },
      select: { isMember: true, membershipExpiry: true },
    });
    return hasActiveMembership(membership);
  } catch {
    return false;
  }
}

export default async function ProductsPage() {
  const session = await auth();
  const [products, categories, isMember] = await Promise.all([
    getProducts(),
    getCategories(),
    getMemberStatus(session?.user?.id),
  ]);

  return (
    <main className="min-h-screen bg-background">

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="bg-white border-b border-border">
        <div className="container mx-auto px-4 md:px-6 xl:px-8 py-6 md:py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">All Products</h1>
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
              <span>/</span>
              <span className="text-foreground font-medium">Products</span>
            </nav>
          </div>
        </div>
      </div>

      {/* Products with Client-side Filtering */}
      <div className="container mx-auto px-4 md:px-6 xl:px-8 py-6 md:py-8">
        <ProductsClient categories={categories} products={products} isMember={isMember} />
      </div>
    </main>
  );
}
