"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

interface Category {
  id: string;
  name: string;
  slug: string;
  _count: { products: number };
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  comparePrice: number | null;
  memberPrice: number | null;
  stock: number;
  images: string[];
  material: string | null;
  hasVariants: boolean;
  category: { name: string; slug: string };
  reviewCount: number;
  variant: {
    id: string;
    price: number;
    comparePrice: number | null;
    memberPrice: number | null;
    stock: number;
    image: string | undefined;
  } | null;
}

interface ProductsClientProps {
  categories: Category[];
  products: Product[];
  isMember?: boolean;
}

export function ProductsClient({ categories, products, isMember = false }: ProductsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const totalProducts = categories.reduce((acc, c) => acc + c._count.products, 0);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category.slug === selectedCategory);
  }, [products, selectedCategory]);

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const pagedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCategoryChange = (slug: string | null) => {
    setSelectedCategory(slug);
    setPage(1);
  };

  const handlePageChange = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Desktop sidebar ────────────────────────────────────── */}
      <aside className="hidden lg:block w-48 shrink-0">
        <div className="sticky top-24">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">Categories</p>
          <div className="space-y-0.5">
            <button
              onClick={() => handleCategoryChange(null)}
              className={cn(
                "w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors",
                selectedCategory === null
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>All Products</span>
              <span className="text-xs tabular-nums text-muted-foreground">{totalProducts}</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.slug)}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors",
                  selectedCategory === cat.slug
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{cat.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{cat._count.products}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* Mobile: horizontal pill filter */}
        <div className="lg:hidden -mx-4 px-4 mb-5">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <button
              onClick={() => handleCategoryChange(null)}
              className={cn(
                "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap",
                selectedCategory === null
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-muted-foreground border-border hover:border-primary hover:text-primary"
              )}
            >
              All ({totalProducts})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.slug)}
                className={cn(
                  "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap",
                  selectedCategory === cat.slug
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-muted-foreground border-border hover:border-primary hover:text-primary"
                )}
              >
                {cat.name} ({cat._count.products})
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredProducts.length}</span>
            {" "}product{filteredProducts.length !== 1 ? "s" : ""}
            {selectedCategory && (
              <> · <span className="text-foreground">{categories.find(c => c.slug === selectedCategory)?.name}</span></>
            )}
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          )}
        </div>

        {pagedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10">
              {pagedProducts.map((product) => (
                <ProductCard key={product.id} product={product} isMember={isMember} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-1">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                      p === page
                        ? "bg-primary text-white"
                        : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
                    )}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-sm">No products in this category.</p>
            <button
              onClick={() => handleCategoryChange(null)}
              className="mt-3 text-sm font-semibold text-primary hover:underline"
            >
              View all products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
