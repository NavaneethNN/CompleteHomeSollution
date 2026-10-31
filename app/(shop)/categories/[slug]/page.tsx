import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/membership";
import { CategoryProductsClient } from "@/components/shop/category-products-client";
import { cacheFetch, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  readonly params: Promise<{ slug: string }>;
}

async function getCategory(slug: string) {
  try {
    return await cacheFetch(
      CACHE_KEYS.categoryProducts(slug),
      CACHE_TTL.categoryProducts,
      async () => {
        const category = await db.category.findUnique({
          where: { slug },
        });

        if (!category) return null;

        const products = await db.product.findMany({
          where: { categoryId: category.id, isActive: true },
          include: {
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

        return {
          category,
          products: products.map((p) => ({
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
            isPreOrder: p.isPreOrder ?? false,
            category: { name: category.name, slug: category.slug },
            reviewCount: p._count.reviews,
            variant: p.hasVariants && p.productVariants[0] ? {
              id: p.productVariants[0].id,
              price: p.productVariants[0].price,
              comparePrice: p.productVariants[0].comparePrice,
              memberPrice: p.productVariants[0].memberPrice,
              stock: p.productVariants[0].stock,
              image: p.productVariants[0].images[0]?.url,
            } : null,
          })),
        };
      }
    );
  } catch (error) {
    console.error("[category] Unable to load catalog", error);
    throw new Error("The catalog is temporarily unavailable.");
  }
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategory(slug);
  
  if (!data) {
    return { title: "Category Not Found" };
  }

  return {
    title: `${data.category.name} — Complete Home Sollution`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [data, session] = await Promise.all([getCategory(slug), auth()]);

  if (!data) notFound();

  const { category, products } = data;
  let isMember = false;
  if (session?.user?.id) {
    try {
      const membership = await db.user.findUnique({
        where: { id: session.user.id },
        select: { isMember: true, membershipExpiry: true },
      });
      isMember = hasActiveMembership(membership);
    } catch {
      // The category data already has a storefront fallback.
    }
  }

  return (
    <main className="min-h-screen bg-background">

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="bg-white border-b border-border">
        <div className="container mx-auto px-4 md:px-6 xl:px-8 py-6 md:py-8 flex items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight truncate">{category.name}</h1>
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 flex-wrap">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
              <span>/</span>
              <Link href="/products" className="hover:text-primary transition-colors">Products</Link>
              <span>/</span>
              <span className="text-foreground font-medium">{category.name}</span>
            </nav>
          </div>
        </div>
      </div>

      {/* ── Products ──────────────────────────────────────────── */}
      <div className="container mx-auto px-4 md:px-6 xl:px-8 py-6 md:py-8">
        <CategoryProductsClient products={products} isMember={isMember} categoryName={category.name} />
      </div>
    </main>
  );
}
