"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Layers, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import { WishlistToggleButton } from "./wishlist-toggle-button";
import {
  ProductPopupModal,
  type ProductPopupModalProduct,
} from "./product-popup-modal";

interface ProductCardProps {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly sku?: string | null;
    readonly description: string;
    readonly basePrice: number;
    readonly comparePrice: number | null;
    readonly memberPrice: number | null;
    readonly stock: number;
    readonly images: string[];
    readonly material: string | null;
    readonly hasVariants: boolean;
    readonly category: { name: string; slug: string };
    readonly reviewCount: number;
    readonly variant: {
      readonly id: string;
      readonly sku?: string | null;
      readonly price: number;
      readonly comparePrice: number | null;
      readonly memberPrice: number | null;
      readonly stock: number;
      readonly image: string | undefined;
    } | null;
  };
  readonly isMember?: boolean;
}

export function ProductCard(props: Readonly<ProductCardProps>) {
  const { product, isMember = false } = props;
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const router = useRouter();
  // Use variant price if available, otherwise use base price
  const displayPrice = product.variant?.price ?? product.basePrice;
  const displayComparePrice = product.variant?.comparePrice ?? product.comparePrice;
  const displayMemberPrice = product.variant?.memberPrice ?? product.memberPrice;
  const displayStock = product.variant?.stock ?? product.stock;
  const displayImage = product.variant?.image ?? product.images[0] ?? "/placeholder.jpg";
  const hasDiscount = displayComparePrice && displayComparePrice > displayPrice;
  let reviewLabel = "reviews";
  if (product.reviewCount === 1) {
    reviewLabel = "review";
  }

  let discountPercent = 0;
  if (hasDiscount) {
    discountPercent = Math.round(((displayComparePrice - displayPrice) / displayComparePrice) * 100);
  }
  const cartVariantId = product.variant?.id ?? null;
  const isInCart = useCartStore((state) => state.isInCart(product.id, cartVariantId));
  const addItem = useCartStore((state) => state.addItem);
  let addToCartButtonClassName = "bg-primary text-white shadow-md hover:bg-primary/90";
  let addToCartIcon: React.ReactNode = <ShoppingCart className="h-4 w-4" />;
  let addToCartLabel = "Add to Cart";

  if (displayStock === 0) {
    addToCartButtonClassName = "cursor-not-allowed bg-muted text-muted-foreground";
    addToCartIcon = null;
    addToCartLabel = "Out of Stock";
  } else if (isInCart) {
    addToCartButtonClassName = "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100";
    addToCartIcon = <Check className="h-4 w-4" />;
    addToCartLabel = "Added";
  }

  const popupProduct: ProductPopupModalProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: displayPrice,
    memberPrice: displayMemberPrice,
    images: [displayImage],
    stock: displayStock,
    description: product.description,
    variantId: cartVariantId,
  };

  const wishlistProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.variant?.sku ?? product.sku,
    price: displayPrice,
    comparePrice: displayComparePrice,
    memberPrice: displayMemberPrice,
    images: [displayImage],
    stock: displayStock,
    description: product.description,
    material: product.material,
    category: product.category,
    variantId: cartVariantId,
    variantLabel: product.variant ? "Selected option" : undefined,
  };

  const handleConfirm = (quantity: number) => {
    let variantLabel: string | undefined;
    if (product.variant) {
      variantLabel = "Selected option";
    }

    addItem(
      {
        ...popupProduct,
        variantLabel,
      },
      quantity
    );
  };

  const handleBuyNow = () => {
    if (displayStock === 0) {
      return;
    }

    let variantLabel: string | undefined;
    if (product.variant) {
      variantLabel = "Selected option";
    }

    addItem(
      {
        ...popupProduct,
        variantLabel,
      },
      1
    );
    router.push("/checkout");
  };

  return (
    <>
      <div className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-300">
      {/* Image Container */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <Link href={`/products/${product.slug}`} className="absolute inset-0 block">
          <Image
            src={displayImage}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          {hasDiscount && (
            <span className="px-2 py-1 bg-destructive text-white text-xs font-semibold rounded-md">
              -{discountPercent}%
            </span>
          )}
          {product.hasVariants && (
            <span className="px-2 py-1 bg-primary/90 text-white text-xs font-medium rounded-md flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Options
            </span>
          )}
        </div>

        <WishlistToggleButton
          product={wishlistProduct}
          className="absolute top-3 right-3 z-10 h-9 w-9"
        />

        {/* Out of Stock Overlay */}
        {displayStock === 0 && (
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-black/50">
            <span className="px-4 py-2 bg-white text-foreground font-semibold rounded-lg">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        <Link
          href={`/categories/${product.category.slug}`}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {product.category.name}
        </Link>

        {/* Title */}
        <Link href={`/products/${product.slug}`}>
          <h3 className="mt-1 font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Material */}
        {product.material && (
          <p className="mt-1 text-xs text-muted-foreground">{product.material}</p>
        )}

        {/* Price Section */}
        <div className="mt-3 flex items-baseline gap-2">
          {/* Main Price */}
          <span className="text-lg font-bold text-foreground">
            ${displayPrice.toLocaleString()}
          </span>

          {/* Compare Price */}
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              ${displayComparePrice.toLocaleString()}
            </span>
          )}
        </div>

        {/* Member Price */}
        {displayMemberPrice && (
          <p className="mt-1 text-sm text-primary font-medium">
            Member: ${displayMemberPrice.toLocaleString()}
          </p>
        )}

        {/* Stock indicator */}
        {displayStock > 0 && displayStock <= 5 && (
          <p className="mt-2 text-xs text-amber-600 font-medium">
            Only {displayStock} left!
          </p>
        )}

        {/* Reviews */}
        {product.reviewCount > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {product.reviewCount} {reviewLabel}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setIsPopupOpen(true)}
            disabled={displayStock === 0}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all duration-200",
              addToCartButtonClassName
            )}
          >
            {addToCartIcon}
            {addToCartLabel}
          </button>

          <button
            type="button"
            onClick={handleBuyNow}
            disabled={displayStock === 0}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all duration-200",
              displayStock === 0
                ? "cursor-not-allowed border border-border bg-muted text-muted-foreground"
                : "border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-white"
            )}
          >
            <Zap className="h-4 w-4" />
            Buy Now
          </button>
        </div>
      </div>
      </div>

      <ProductPopupModal
        open={isPopupOpen}
        onOpenChange={setIsPopupOpen}
        product={popupProduct}
        onConfirm={handleConfirm}
      />
    </>
  );
}
