"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlistStore, type WishlistProduct } from "@/store/wishlist";

interface WishlistToggleButtonProps {
  readonly product: WishlistProduct;
  readonly className?: string;
}

export function WishlistToggleButton({ product, className }: WishlistToggleButtonProps) {
  const [mounted, setMounted] = useState(false);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist(product.id, product.variantId ?? null));
  const toggleItem = useWishlistStore((state) => state.toggleItem);

  useEffect(() => { setMounted(true); }, []);

  // Before mount: render neutral state identical to what SSR produces — no mismatch
  const active = mounted && isInWishlist;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleItem(product);
      }}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border bg-white/95 text-foreground shadow-sm transition-all duration-200 hover:scale-105 hover:text-primary",
        active ? "border-destructive text-destructive" : "",
        className
      )}
    >
      {active ? (
        <svg className="h-5 w-5 text-destructive transition-all" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        <Heart className="h-5 w-5 transition-all" />
      )}
    </button>
  );
}
