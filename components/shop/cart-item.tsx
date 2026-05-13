"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem as CartItemType } from "@/store/cart";
import { useWishlistStore } from "@/store/wishlist";
import { cn } from "@/lib/utils";

interface CartItemProps {
  readonly item: CartItemType;
  readonly onUpdateQuantity: (quantity: number) => void;
  readonly onRemove: () => void;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export function CartItem({ item, onUpdateQuantity, onRemove }: Readonly<CartItemProps>) {
  const { product, quantity } = item;
  const image = product.images[0] ?? "/placeholder.jpg";
  const subtotal = product.price * quantity;
  const addToWishlist = useWishlistStore((state) => state.addItem);

  const handleMoveToWishlist = () => {
    addToWishlist({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      memberPrice: product.memberPrice,
      images: product.images,
      stock: product.stock,
      description: product.description,
      variantId: product.variantId ?? null,
      variantLabel: product.variantLabel,
    });
    onRemove();
  };

  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
      <div className="flex flex-row items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href={`/products/${product.slug}`}
          className="relative block h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28"
        >
          <Image src={image} alt={product.name} fill className="object-cover" sizes="112px" />
        </Link>

        <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Link href={`/products/${product.slug}`} className="line-clamp-2 text-sm font-bold text-foreground transition-colors hover:text-primary sm:text-base">
              {product.name}
            </Link>
            {product.variantLabel ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">
                {product.variantLabel}
              </p>
            ) : null}
            {product.description ? (
              <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">{product.description}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:text-sm">
            <span className="font-semibold text-foreground">Unit: {currencyFormatter.format(product.price)}</span>
            <span className="font-semibold text-foreground">Subtotal: {currencyFormatter.format(subtotal)}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 sm:gap-4">
          <div className="flex items-center rounded-xl border border-border bg-secondary/40 shadow-sm">
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity - 1)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-l-xl transition-colors sm:h-10 sm:w-10",
                "hover:bg-secondary"
              )}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
            <span className="min-w-10 px-2.5 text-center text-sm font-bold text-foreground sm:min-w-12 sm:px-3">{quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity + 1)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-r-xl transition-colors sm:h-10 sm:w-10",
                "hover:bg-secondary"
              )}
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-none">
            <button
              type="button"
              onClick={handleMoveToWishlist}
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white sm:flex-none sm:text-sm"
            >
              <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Move to Wishlist
            </button>

            <button
              type="button"
              onClick={onRemove}
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white sm:flex-none sm:text-sm"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Remove
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}