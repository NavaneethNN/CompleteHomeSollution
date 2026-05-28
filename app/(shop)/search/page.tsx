import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Search, SlidersHorizontal, Package, ArrowRight } from "lucide-react";
import { HomeTrendingProductCard } from "@/components/shop/home-trending-product-card";
import { auth } from "@/auth";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `"${q}" — Search Results` : "Search Products",
    description: q ? `Browse search results for "${q}"` : "Search our furniture catalogue",
  };
}

const LIMIT = 12;

async function searchProducts(q: string, page: number) {
  if (!q || q.length < 2) return { products: [], total: 0 };
  const where = {
    isActive: true,
    OR: [
      { name:        { contains: q, mode: "insensitive" as const } },
      { sku:         { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } },
      { category: { name: { contains: q, mode: "insensitive" as const } } },
    ],
  };
  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: { select: { name: true, slug: true } },
        productVariants: {
          where:   { isActive: true },
          include: { images: { take: 1, orderBy: { displayOrder: "asc" } }, values: { include: { variantValue: true } } },
          orderBy: { price: "asc" },
          take:    1,
        },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    LIMIT,
      skip:    (page - 1) * LIMIT,
    }),
    db.product.count({ where }),
  ]);
  return { products, total };
}

async function getRelatedCategories(q: string) {
  if (!q) return [];
  return db.category.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    take: 4,
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "", page: pageParam = "1" } = await searchParams;
  const page    = Math.max(1, parseInt(pageParam));
  const session = await auth();
  const dbUser  = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id }, select: { isMember: true } })
    : null;
  const isMember = dbUser?.isMember ?? false;

  const { products, total } = await searchProducts(q, page);
  const totalPages = Math.ceil(total / LIMIT);

  const currencyFmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-white">
      {/* ── Search Bar Section ── */}
      <div className="bg-slate-50 border-b border-slate-200 py-8">
        <div className="container mx-auto px-5 md:px-6 xl:px-8 max-w-screen-xl">
          <form method="GET" action="/search" className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                type="text"
                placeholder="Search furniture, categories, SKUs…"
                autoFocus
                className="w-full h-14 pl-12 pr-36 rounded-xl border-2 border-slate-200 focus:border-primary focus:outline-none text-base bg-white shadow-sm transition-colors"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-6 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary/90 transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {q && (
            <div className="max-w-2xl mx-auto mt-3 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {total > 0
                  ? <><span className="font-semibold text-slate-800">{total}</span> result{total !== 1 ? "s" : ""} for <span className="font-semibold text-slate-800">"{q}"</span></>
                  : <>No results for <span className="font-semibold text-slate-800">"{q}"</span></>
                }
              </p>
              {q && (
                <Link href="/search" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  Clear
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      <div className="container mx-auto px-5 md:px-6 xl:px-8 max-w-screen-xl py-10">
        {!q ? (
          /* Empty query state */
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Search className="h-10 w-10 text-slate-300" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-800 mb-1">Search our catalogue</h2>
              <p className="text-slate-500 text-sm">Enter a product name, category, or SKU above to get started.</p>
            </div>
            <Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline mt-2">
              Browse all products <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : products.length === 0 ? (
          /* No results state */
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Package className="h-10 w-10 text-slate-300" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-800 mb-1">No results found</h2>
              <p className="text-slate-500 text-sm max-w-sm">
                We couldn't find anything matching <strong>"{q}"</strong>. Try different keywords or browse by category.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Link href="/products" className="inline-flex items-center gap-2 bg-primary text-white font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-primary/90 transition-colors">
                Browse All Products
              </Link>
              <Link href="/categories" className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                All Categories
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Results grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              {products.map((p) => {
                const variant  = p.productVariants[0];
                const price    = variant?.price ?? p.basePrice;
                const imgUrl   = variant?.images[0]?.url ?? p.images[0] ?? null;
                const memberP  = p.memberPrice ?? null;
                return (
                  <HomeTrendingProductCard
                    key={p.id}
                    isMember={isMember}
                    product={{
                      id:            p.id,
                      name:          p.name,
                      slug:          p.slug,
                      price,
                      originalPrice: p.comparePrice ?? price,
                      discount:      p.comparePrice && p.comparePrice > price
                        ? `-${Math.round(((p.comparePrice - price) / p.comparePrice) * 100)}%`
                        : null,
                      reviews:       p._count.reviews,
                      img:           imgUrl,
                      description:   "",
                      memberPrice:   memberP,
                      stock:         0,
                      category:      p.category,
                    }}
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                {page > 1 && (
                  <Link
                    href={`/search?q=${encodeURIComponent(q)}&page=${page - 1}`}
                    className="h-10 px-4 flex items-center gap-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Previous
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={`/search?q=${encodeURIComponent(q)}&page=${p}`}
                    className={`h-10 w-10 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                      p === page
                        ? "bg-primary text-white"
                        : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </Link>
                ))}
                {page < totalPages && (
                  <Link
                    href={`/search?q=${encodeURIComponent(q)}&page=${page + 1}`}
                    className="h-10 px-4 flex items-center gap-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Next
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

