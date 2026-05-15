"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ShoppingCart, Trash2, Heart, Package, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import { useWishlistStore, type WishlistProduct } from "@/store/wishlist";
import { ProductPopupModal, type ProductPopupModalProduct } from "./product-popup-modal";

interface WishlistItemProps {
  readonly product: WishlistProduct;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export function WishlistItem({ product }: WishlistItemProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const removeItem = useWishlistStore((state) => state.removeItem);
  const isInCart = useCartStore((state) => state.isInCart(product.id, product.variantId ?? null));
  const addItem = useCartStore((state) => state.addItem);
  const image = product.images[0] ?? "/placeholder.jpg";
  const displayComparePrice = product.comparePrice ?? null;
  const outOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  const popupProduct: ProductPopupModalProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    memberPrice: product.memberPrice,
    images: [image],
    stock: product.stock,
    description: product.description,
    variantId: product.variantId ?? null,
    variantLabel: product.variantLabel,
  };

  const handleMoveToCart = (quantity: number) => {
    addItem(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        price: product.price,
        memberPrice: product.memberPrice,
        images: product.images,
        stock: product.stock,
        description: product.description,
        variantId: product.variantId ?? null,
        variantLabel: product.variantLabel,
      },
      quantity
    );
    removeItem(product.id, product.variantId ?? null);
  };

  let addToCartClassName = "bg-primary text-white hover:bg-primary/90 shadow-md";
  let addToCartLabel = "Add to Cart";
  let addToCartIcon: React.ReactNode = <ShoppingCart className="h-3.5 w-3.5" />;

  if (outOfStock) {
    addToCartClassName = "cursor-not-allowed bg-muted text-muted-foreground";
    addToCartLabel = "Out of Stock";
    addToCartIcon = null;
  } else if (isInCart) {
    addToCartClassName = "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100";
    addToCartLabel = "Added";
    addToCartIcon = <Check className="h-3.5 w-3.5" />;
  }

  return (
    <>
      <div className="group block">
        <div className="bg-white rounded-2xl border border-border hover:shadow-xl transition-shadow duration-300 overflow-hidden">
          {/* Image Container */}
          <div className="relative aspect-square bg-secondary overflow-hidden">
            <Link href={`/products/${product.slug}`} className="absolute inset-0 block">
              <Image
                src={image}
                alt={product.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </Link>

            {/* Remove Button (Heart/X style like wishlist toggle) */}
            <button
              type="button"
              onClick={() => removeItem(product.id, product.variantId ?? null)}
              className="absolute top-3 right-3 z-10 h-9 w-9 inline-flex items-center justify-center rounded-full border border-border bg-white/95 text-foreground shadow-sm transition-all duration-200 hover:scale-105 hover:text-destructive"
              aria-label={`Remove ${product.name} from wishlist`}
            >
              <Heart className="h-5 w-5 text-destructive fill-current" />
            </button>

            {/* Out of Stock Overlay */}
            {outOfStock && (
              <div className="absolute inset-0 z-0 flex items-center justify-center bg-black/50">
                <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-foreground">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            <Link
              href={`/categories/${product.category.slug}`}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {product.category.name}
            </Link>

            <Link href={`/products/${product.slug}`}>
              <h4 className="mt-1 text-sm font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors">
                {product.name}
              </h4>
            </Link>

            {/* SKU */}
            {product.sku && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <Package className="h-3 w-3" />
                <span>SKU: {product.sku}</span>
              </div>
            )}

            {/* Variant Details */}
            {product.variantLabel ? (
              <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2">
                <p className="text-xs font-semibold text-foreground">
                  Variant: {product.variantLabel}
                </p>
              </div>
            ) : null}

            {/* Price */}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-base font-black text-foreground">
                {currencyFormatter.format(product.price)}
              </span>
              {displayComparePrice && displayComparePrice > product.price && (
                <span className="text-xs text-muted-foreground line-through">
                  {currencyFormatter.format(displayComparePrice)}
                </span>
              )}
            </div>

            {/* Stock indicator */}
            {isLowStock && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                <span>Only {product.stock} left!</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!isInCart && !outOfStock) {
                    setMoveOpen(true);
                  }
                }}
                disabled={outOfStock || isInCart}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors",
                  addToCartClassName
                )}
              >
                {addToCartIcon}
                {addToCartLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ProductPopupModal
        open={moveOpen}
        onOpenChange={setMoveOpen}
        product={popupProduct}
        confirmLabel="Move to Cart"
        onConfirm={handleMoveToCart}
      />
    </>
  );
}
