"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

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

interface CategoryProductsClientProps {
  products: Product[];
  isMember?: boolean;
  categoryName: string;
}

export function CategoryProductsClient({ products, isMember = false, categoryName }: CategoryProductsClientProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(products.length / PAGE_SIZE);
  const pagedProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePageChange = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      {/* Result count */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{products.length}</span>
          {" "}product{products.length !== 1 ? "s" : ""} in{" "}
          <span className="text-foreground">{categoryName}</span>
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
          <p className="text-muted-foreground text-sm">No products found in this category.</p>
        </div>
      )}
    </div>
  );
}
