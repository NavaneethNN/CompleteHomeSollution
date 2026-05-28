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
        <div className="bg-white rounded-xl sm:rounded-2xl border border-border hover:shadow-xl transition-shadow duration-300 overflow-hidden">
          {/* Image Container */}
          <div className="relative aspect-square bg-secondary overflow-hidden">
            <Link href={`/products/${product.slug}`} className="absolute inset-0 block">
              <Image
                src={image}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </Link>

            {/* Remove Button */}
            <button
              type="button"
              onClick={() => removeItem(product.id, product.variantId ?? null)}
              className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-full border border-border bg-white/95 text-foreground shadow-sm transition-all duration-200 hover:scale-105 hover:text-destructive"
              aria-label={`Remove ${product.name} from wishlist`}
            >
              <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-destructive fill-current" />
            </button>

            {/* Out of Stock Overlay */}
            {outOfStock && (
              <div className="absolute inset-0 z-0 flex items-center justify-center bg-black/50">
                <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-foreground">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4">
            <Link
              href={`/categories/${product.category.slug}`}
              className="text-[10px] sm:text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wide truncate block"
            >
              {product.category.name}
            </Link>

            <Link href={`/products/${product.slug}`}>
              <h4 className="mt-0.5 text-xs sm:text-sm font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors">
                {product.name}
              </h4>
            </Link>

            {/* SKU */}
            {product.sku && (
              <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground overflow-hidden">
                <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                <span className="truncate">SKU: {product.sku}</span>
              </div>
            )}

            {/* Variant Details */}
            {product.variantLabel ? (
              <div className="mt-1.5 rounded-lg bg-secondary/50 px-2 py-1.5 sm:px-3 sm:py-2">
                <p className="text-[10px] sm:text-xs font-semibold text-foreground truncate">
                  {product.variantLabel}
                </p>
              </div>
            ) : null}

            {/* Price */}
            <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-black text-foreground">
                {currencyFormatter.format(product.price)}
              </span>
              {displayComparePrice && displayComparePrice > product.price && (
                <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                  {currencyFormatter.format(displayComparePrice)}
                </span>
              )}
            </div>

            {/* Stock indicator */}
            {isLowStock && (
              <div className="flex items-center gap-1 mt-1.5 text-[10px] sm:text-xs text-amber-600">
                <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                <span>Only {product.stock} left!</span>
              </div>
            )}

            {/* Action Button */}
            <div className="mt-3 sm:mt-4">
              <button
                type="button"
                onClick={() => {
                  if (!isInCart && !outOfStock) {
                    setMoveOpen(true);
                  }
                }}
                disabled={outOfStock || isInCart}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl px-2 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold transition-colors min-h-[40px] sm:min-h-[44px]",
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
