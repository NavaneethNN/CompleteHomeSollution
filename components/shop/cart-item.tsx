"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
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
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const inWishlist = isInWishlist(product.id, product.variantId ?? null);

  const handleMoveToWishlist = () => {
    addToWishlist({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      images: product.images,
      stock: product.stock,
      description: product.description,
      memberPrice: product.memberPrice,
      comparePrice: product.comparePrice,
      variantId: product.variantId ?? null,
      variantLabel: product.variantLabel,
    });

    onRemove();
  };

  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
      <div className="flex flex-row items-center gap-4">
        <Link
          href={`/products/${product.slug}`}
          className="relative block h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-muted md:h-36 md:w-36"
        >
          <Image src={image} alt={product.name} fill className="object-cover" sizes="112px" />
        </Link>

        <div className="flex-1">
          <div className="flex flex-col">
            <Link href={`/products/${product.slug}`} className="text-base font-bold text-foreground transition-colors hover:text-primary">
              {product.name}
            </Link>
            {product.variantLabel ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {product.variantLabel}
              </p>
            ) : null}
            {product.description ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
            ) : null}
          </div>

          <div className="mt-2 hidden items-center justify-between gap-3 md:flex">
            <div className="min-w-0 text-sm leading-5">
              <div className="whitespace-nowrap font-semibold text-foreground">
                <span>Unit: </span>
                <span>{currencyFormatter.format(product.price)}</span>
              </div>
              <div className="whitespace-nowrap font-semibold text-foreground">
                <span>Subtotal: </span>
                <span>{currencyFormatter.format(subtotal)}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center rounded-xl border border-border bg-secondary/40 shadow-sm">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(quantity - 1)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-l-xl transition-colors",
                    "hover:bg-secondary"
                  )}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-12 px-3 text-center text-sm font-bold text-foreground">{quantity}</span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(quantity + 1)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-r-xl transition-colors",
                    "hover:bg-secondary"
                  )}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMoveToWishlist}
                  disabled={inWishlist}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                    inWishlist
                      ? "border-border bg-secondary text-muted-foreground"
                      : "border-foreground/15 bg-white text-foreground hover:bg-foreground hover:text-white"
                  )}
                >
                  {inWishlist ? "In Wishlist" : "Move to Wishlist"}
                </button>

                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2 md:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm leading-5">
                <div className="whitespace-nowrap font-semibold text-foreground">
                  <span>Unit: </span>
                  <span>{currencyFormatter.format(product.price)}</span>
                </div>
                <div className="whitespace-nowrap font-semibold text-foreground">
                  <span>Subtotal: </span>
                  <span>{currencyFormatter.format(subtotal)}</span>
                </div>
              </div>

              <div className="flex items-center rounded-xl border border-border bg-secondary/40 shadow-sm">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(quantity - 1)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-l-xl transition-colors",
                    "hover:bg-secondary"
                  )}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-10 px-2.5 text-center text-sm font-bold text-foreground">{quantity}</span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(quantity + 1)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-r-xl transition-colors",
                    "hover:bg-secondary"
                  )}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMoveToWishlist}
                disabled={inWishlist}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                  inWishlist
                    ? "border-border bg-secondary text-muted-foreground"
                    : "border-foreground/15 bg-white text-foreground hover:bg-foreground hover:text-white"
                )}
              >
                {inWishlist ? "In Wishlist" : "Move to Wishlist"}
              </button>

              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}