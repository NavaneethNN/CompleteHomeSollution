"use client";

import { useState, useMemo } from "react";
import { CategoryFilter } from "./category-filter";
import { ProductCard } from "./product-card";

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

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category.slug === selectedCategory);
  }, [products, selectedCategory]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar - Minimal */}
      <aside className="w-full lg:w-52 shrink-0">
        <div className="bg-white rounded-lg border border-border p-3">
          <h3 className="font-medium text-sm text-foreground mb-3 px-2">Categories</h3>
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>
      </aside>

      {/* Product Grid - Minimal */}
      <div className="flex-1">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredProducts.length}</span> of {products.length} products
            {selectedCategory && (
              <span> in <span className="font-medium text-foreground">{categories.find(c => c.slug === selectedCategory)?.name}</span></span>
            )}
          </p>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} isMember={isMember} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">No products found in this category.</p>
            <button
              onClick={() => setSelectedCategory(null)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              View all products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
