import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { CategoryProductsClient } from "@/components/shop/category-products-client";
import { fallbackCategories, fallbackProducts } from "@/lib/data/fallback-shop-data";

export const revalidate = 3600;

interface CategoryPageProps {
  readonly params: Promise<{ slug: string }>;
}

async function getCategory(slug: string) {
  try {
    const category = await db.category.findUnique({
      where: { slug },
    });

    if (!category) {
      const fallbackCategory = fallbackCategories.find((item) => item.slug === slug);
      if (!fallbackCategory) return null;

      return {
        category: fallbackCategory,
        products: fallbackProducts.filter((product) => product.category.slug === slug),
      };
    }

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

    if (products.length === 0) {
      return {
        category,
        products: fallbackProducts.filter((product) => product.category.slug === slug),
      };
    }

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
  } catch {
    const fallbackCategory = fallbackCategories.find((item) => item.slug === slug);
    if (!fallbackCategory) return null;

    return {
      category: fallbackCategory,
      products: fallbackProducts.filter((product) => product.category.slug === slug),
    };
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
  const dbUser = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id }, select: { isMember: true } })
    : null;
  const isMember = dbUser?.isMember ?? false;

  return (
    <main className="min-h-screen bg-background">

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="bg-white border-b border-border">
        <div className="container mx-auto px-4 md:px-6 xl:px-8 py-6 md:py-8 flex items-center gap-4">
          <Link href="/" className="shrink-0">
            <Image
              src="/chs-logo.png"
              alt="Complete Home Sollution"
              width={430}
              height={131}
              className="h-10 md:h-12 w-auto object-contain"
            />
          </Link>
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-foreground leading-tight truncate">{category.name}</h1>
            <nav className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
              <span>/</span>
              <Link href="/products" className="hover:text-primary transition-colors">Products</Link>
              <span>/</span>
              <span className="text-foreground">{category.name}</span>
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
