"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, AlertCircle, Crown } from "lucide-react";
import type { CartItem as CartItemType } from "@/store/cart";
import { cn } from "@/lib/utils";

interface CartItemProps {
  readonly item: CartItemType;
  readonly isMember?: boolean;
  readonly onUpdateQuantity: (quantity: number) => void;
  readonly onRemove: () => void;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export function CartItem({ item, isMember = false, onUpdateQuantity, onRemove }: Readonly<CartItemProps>) {
  const { product, quantity } = item;
  const image = product.images[0] ?? "/placeholder.jpg";
  const hasMemberPrice = isMember && product.memberPrice != null && product.memberPrice > 0 && product.memberPrice < product.price;
  const effectivePrice = hasMemberPrice ? product.memberPrice! : product.price;
  const subtotal = effectivePrice * quantity;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isOutOfStock = product.stock <= 0;

  return (
    <article className="flex gap-3 rounded-xl border border-border bg-white p-3 sm:gap-4 sm:p-4">
      {/* Thumbnail — fixed small size always */}
      <Link
        href={`/products/${product.slug}`}
        className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-20"
      >
        <Image
          src={image}
          alt={product.name}
          fill
          className="object-cover"
          sizes="80px"
        />
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded px-1 py-0.5 text-[10px] font-semibold text-white">Out of Stock</span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        {/* Top row: name + remove button */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/products/${product.slug}`}
              className="block text-sm font-semibold leading-snug text-foreground hover:text-primary transition-colors line-clamp-2"
            >
              {product.name}
            </Link>
            {product.variantLabel && (
              <p className="mt-0.5 text-xs text-muted-foreground">{product.variantLabel}</p>
            )}
            {isLowStock && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Only {product.stock} left
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove item"
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Bottom row: price + qty stepper */}
        <div className="flex items-center justify-between gap-2">
          {/* Price */}
          <div>
            {hasMemberPrice ? (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-primary">{currencyFormatter.format(subtotal)}</span>
                <span className="text-xs text-muted-foreground line-through">{currencyFormatter.format(product.price * quantity)}</span>
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-primary">
                  <Crown className="h-2.5 w-2.5" /> Member
                </span>
              </div>
            ) : (
              <span className="text-sm font-bold text-foreground">{currencyFormatter.format(subtotal)}</span>
            )}
            {quantity > 1 && (
              <p className="text-[11px] text-muted-foreground">
                {currencyFormatter.format(effectivePrice)} each
              </p>
            )}
          </div>

          {/* Qty stepper */}
          <div className={cn(
            "flex items-center rounded-lg border border-border bg-secondary/30",
            isOutOfStock && "opacity-50"
          )}>
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity - 1)}
              disabled={isOutOfStock}
              className="flex h-7 w-7 items-center justify-center rounded-l-lg text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-7 text-center text-xs font-bold text-foreground">{quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity + 1)}
              disabled={isOutOfStock || quantity >= product.stock}
              className="flex h-7 w-7 items-center justify-center rounded-r-lg text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Increase quantity"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}