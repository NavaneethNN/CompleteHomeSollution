"use client";

import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlist";
import { WishlistItem } from "./wishlist-item";
import { WishlistEmptyState } from "./wishlist-empty-state";

function SectionHeading({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="text-center mb-8 md:mb-10">
      <p className="text-[11px] sm:text-sm font-semibold tracking-widest text-primary uppercase mb-2">{tag}</p>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground mb-3">{title}</h2>
      <div className="flex items-center justify-center gap-1.5">
        <span className="w-8 h-[3px] rounded-full bg-primary" />
        <span className="w-3 h-[3px] rounded-full bg-border" />
      </div>
    </div>
  );
}

export function WishlistPage() {
  const items = useWishlistStore((state) => state.items);

  if (items.length === 0) {
    return (
      <main className="bg-background py-10 md:py-16">
        <div className="container mx-auto px-4 sm:px-5 md:px-6 xl:px-8">
          <WishlistEmptyState />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-white py-8 md:py-16">
      <div className="container mx-auto px-4 sm:px-5 md:px-6 xl:px-8">
        <SectionHeading tag="YOUR SAVED ITEMS" title="Your Wishlist" />

        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-4">
          {items.map((product) => (
            <WishlistItem key={`${product.id}:${product.variantId ?? "default"}`} product={product} />
          ))}
        </section>

        <div className="text-center mt-8 md:mt-10">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white font-bold text-xs sm:text-sm px-6 sm:px-8 py-3 sm:py-3.5 rounded transition-colors min-h-[44px]"
          >
            CONTINUE SHOPPING <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
