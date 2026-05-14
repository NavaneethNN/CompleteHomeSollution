"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem as CartItemType } from "@/store/cart";
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

  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link
          href={`/products/${product.slug}`}
          className="relative block aspect-square w-full overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28 sm:flex-shrink-0"
        >
          <Image src={image} alt={product.name} fill className="object-cover" sizes="112px" />
        </Link>

        <div className="flex-1 space-y-3">
          <div className="flex flex-col gap-1">
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

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-foreground">Unit: {currencyFormatter.format(product.price)}</span>
            <span className="font-semibold text-foreground">Subtotal: {currencyFormatter.format(subtotal)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-4">
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
    </article>
  );
}