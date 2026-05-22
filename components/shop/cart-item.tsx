"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, Package, AlertCircle, Crown } from "lucide-react";
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
    <article className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Product Image */}
        <Link
          href={`/products/${product.slug}`}
          className="relative block aspect-square w-full overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28 sm:flex-shrink-0"
        >
          <Image src={image} alt={product.name} fill className="object-cover" sizes="112px" />
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-foreground">
                Out of Stock
              </span>
            </div>
          )}
        </Link>

        {/* Product Details */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name & SKU */}
          <div className="flex flex-col gap-1">
            <Link 
              href={`/products/${product.slug}`} 
              className="text-base font-bold text-foreground transition-colors hover:text-primary line-clamp-2"
            >
              {product.name}
            </Link>
            {product.sku && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Package className="h-3 w-3" />
                <span>SKU: {product.sku}</span>
              </div>
            )}
          </div>

          {/* Variant Details */}
          {product.variantLabel ? (
            <div className="rounded-lg bg-secondary/50 px-3 py-2">
              <p className="text-xs font-semibold text-foreground">
                Variant: {product.variantLabel}
              </p>
            </div>
          ) : null}

          {/* Stock Status */}
          {isLowStock && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3 w-3" />
              <span>Only {product.stock} left in stock!</span>
            </div>
          )}

          {/* Price Info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm pt-1">
            <span className="text-muted-foreground flex items-center gap-1">
              Unit:{" "}
              {hasMemberPrice ? (
                <>
                  <span className="font-semibold text-primary">{currencyFormatter.format(effectivePrice)}</span>
                  <span className="text-xs line-through text-muted-foreground">{currencyFormatter.format(product.price)}</span>
                </>
              ) : (
                <span className="font-semibold text-foreground">{currencyFormatter.format(product.price)}</span>
              )}
            </span>
            <span className="text-muted-foreground">
              Subtotal: <span className="font-semibold text-primary">{currencyFormatter.format(subtotal)}</span>
            </span>
          </div>
          {hasMemberPrice && (
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              <Crown className="h-3 w-3" /> Member price applied
            </p>
          )}
        </div>

        {/* Quantity Controls & Remove */}
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end sm:justify-start sm:gap-3">
          <div className="flex items-center rounded-xl border border-border bg-secondary/40 shadow-sm">
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity - 1)}
              disabled={isOutOfStock}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-l-xl transition-colors",
                "hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-12 px-3 text-center text-sm font-bold text-foreground">{quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity + 1)}
              disabled={isOutOfStock || quantity >= product.stock}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-r-xl transition-colors",
                "hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onRemove}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white sm:flex-none"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Remove</span>
          </button>
        </div>
      </div>
    </article>
  );
}