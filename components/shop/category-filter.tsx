"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  categories: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    _count: { products: number };
  }[];
}

export function CategoryFilter({ categories }: CategoryFilterProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category");

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <h3 className="font-semibold text-foreground mb-4">Categories</h3>
      
      <ul className="space-y-1">
        <li>
          <Link
            href="/products"
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
              !currentCategory
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>All Products</span>
            <span className="text-xs">
              {categories.reduce((acc, c) => acc + c._count.products, 0)}
            </span>
          </Link>
        </li>
        
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/categories/${category.slug}`}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                currentCategory === category.slug
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span>{category.name}</span>
              <span className="text-xs text-muted-foreground">
                {category._count.products}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
