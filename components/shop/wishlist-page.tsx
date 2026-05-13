"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlist";
import { WishlistItem } from "./wishlist-item";
import { WishlistEmptyState } from "./wishlist-empty-state";

export function WishlistPage() {
  const items = useWishlistStore((state) => state.items);
  const clearWishlist = useWishlistStore((state) => state.clearWishlist);

  if (items.length === 0) {
    return (
      <main className="bg-background py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 xl:px-8">
          <WishlistEmptyState />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-6 xl:px-8">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Wishlist</p>
            <h1 className="mt-2 text-3xl font-black text-foreground md:text-5xl">Your saved products</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Keep track of the products you love, move them to cart when you’re ready, or remove them anytime.
            </p>
          </div>

          <button
            type="button"
            onClick={clearWishlist}
            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Clear Wishlist
          </button>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {items.map((product) => (
            <WishlistItem key={`${product.id}:${product.variantId ?? "default"}`} product={product} />
          ))}
        </section>

        <div className="mt-8 flex justify-center">
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-foreground px-6 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-foreground hover:text-white"
          >
            <Heart className="h-4 w-4" />
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
