"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ShoppingCart, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useWishlistStore, type WishlistProduct } from "@/store/wishlist";
import { ProductPopupModal, type ProductPopupModalProduct } from "./product-popup-modal";

interface WishlistItemProps {
  readonly product: WishlistProduct;
}

export function WishlistItem({ product }: WishlistItemProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const removeItem = useWishlistStore((state) => state.removeItem);
  const isInCart = useCartStore((state) => state.isInCart(product.id, product.variantId ?? null));
  const addItem = useCartStore((state) => state.addItem);
  const image = product.images[0] ?? "/placeholder.jpg";
  const displayComparePrice = product.comparePrice ?? null;
  const displayMemberPrice = product.memberPrice ?? null;

  const popupProduct: ProductPopupModalProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    memberPrice: displayMemberPrice,
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

  return (
    <>
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
              <p className="text-sm font-semibold text-foreground">
                ${product.price.toLocaleString()}
                {displayComparePrice && displayComparePrice > product.price ? (
                  <span className="ml-2 text-xs font-medium text-muted-foreground line-through">
                    ${displayComparePrice.toLocaleString()}
                  </span>
                ) : null}
              </p>
              {product.stock > 0 ? (
                <p className="text-xs font-medium text-emerald-600">
                  In stock{product.stock <= 5 ? ` - Only ${product.stock} left` : ""}
                </p>
              ) : (
                <p className="text-xs font-medium text-destructive">Out of stock</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  if (!isInCart) {
                    setMoveOpen(true);
                  }
                }}
                disabled={product.stock <= 0 || isInCart}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {isInCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                {isInCart ? "Added to Cart" : "Move to Cart"}
              </button>

              <button
                type="button"
                onClick={() => removeItem(product.id, product.variantId ?? null)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        </div>
      </article>

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
