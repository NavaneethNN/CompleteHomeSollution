import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProductCard } from "@/components/shop/product-card";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
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

export default async function CategoryPage({
  params,
}: CategoryPageProps) {
  const { slug } = await params;
  const data = await getCategory(slug);

  if (!data) {
    notFound();
  }

  const { category, products } = data;

  return (
    <main className="min-h-screen bg-background">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 py-3">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: category.name },
          ]}
        />
      </div>

      {/* Hero */}
      <section className="bg-navy py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{category.name}</h1>
          <p className="text-white/70">
            Browse our collection of {products.length} {products.length === 1 ? "product" : "products"} in this category.
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8">
        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No products found in this category.</p>
          </div>
        )}
      </div>
    </main>
  );
}
