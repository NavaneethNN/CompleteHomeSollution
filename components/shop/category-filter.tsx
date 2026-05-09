"use client";

import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  _count: { products: number };
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string | null;
  onCategoryChange: (slug: string | null) => void;
}

export function CategoryFilter({ categories, selectedCategory, onCategoryChange }: CategoryFilterProps) {
  const totalProducts = categories.reduce((acc, c) => acc + c._count.products, 0);

  return (
    <div className="space-y-1">
      <button
        onClick={() => onCategoryChange(null)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
          selectedCategory === null
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span>All Products</span>
        <span className="text-xs">{totalProducts}</span>
      </button>
      
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.slug)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
            selectedCategory === category.slug
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <span>{category.name}</span>
          <span className="text-xs text-muted-foreground">
            {category._count.products}
          </span>
        </button>
      ))}
    </div>
  );
}
