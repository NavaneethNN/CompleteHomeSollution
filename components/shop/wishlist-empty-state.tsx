"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

export function WishlistEmptyState() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl sm:rounded-[2rem] border border-border bg-white p-6 sm:p-8 text-center shadow-sm md:p-12">
      <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/10 text-primary">
        <Heart className="h-6 w-6 sm:h-7 sm:w-7 fill-current" />
      </div>
      <h1 className="mt-4 sm:mt-5 text-2xl sm:text-3xl font-black text-foreground md:text-4xl">Your wishlist is empty</h1>
      <p className="mt-2.5 sm:mt-3 text-sm leading-relaxed text-muted-foreground">
        Save the products you love and come back to them any time.
      </p>

      <div className="mt-6 sm:mt-8 flex justify-center">
        <Link
          href="/products"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 sm:py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary/90 min-h-[44px]"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
