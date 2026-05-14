"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Layers, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import {
  ProductPopupModal,
  type ProductPopupModalProduct,
} from "./product-popup-modal";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    basePrice: number;
    comparePrice: number | null;
    memberPrice: number | null;
    stock: number;
    images: string[];
    material: string | null;
    hasVariants: boolean;
    category: { name: string; slug: string };
    reviewCount: number;
    variant: {
      id: string;
      price: number;
      comparePrice: number | null;
      memberPrice: number | null;
      stock: number;
      image: string | undefined;
    } | null;
  };
  isMember?: boolean;
}

export function ProductCard({ product, isMember = false }: ProductCardProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  // Use variant price if available, otherwise use base price
  const displayPrice = product.variant?.price ?? product.basePrice;
  const displayComparePrice = product.variant?.comparePrice ?? product.comparePrice;
  const displayMemberPrice = product.variant?.memberPrice ?? product.memberPrice;
  const displayStock = product.variant?.stock ?? product.stock;
  const displayImage = product.variant?.image ?? product.images[0] ?? "/placeholder.jpg";
  const hasDiscount = displayComparePrice && displayComparePrice > displayPrice;
  const discountPercent = hasDiscount
    ? Math.round(((displayComparePrice - displayPrice) / displayComparePrice) * 100)
    : 0;
  const cartVariantId = product.variant?.id ?? null;
  const isInCart = useCartStore((state) => state.isInCart(product.id, cartVariantId));
  const addItem = useCartStore((state) => state.addItem);

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

  const handleConfirm = (quantity: number) => {
    addItem(
      {
        ...popupProduct,
        variantLabel: product.variant ? "Selected option" : undefined,
      },
      quantity
    );
  };

  return (
    <>
      <div className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-300">
      {/* Image Container */}
      <Link href={`/products/${product.slug}`} className="block relative aspect-[4/3] bg-muted overflow-hidden">
        <Image
          src={displayImage}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
        />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
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

        {/* Out of Stock Overlay */}
        {displayStock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="px-4 py-2 bg-white text-foreground font-semibold rounded-lg">
              Out of Stock
            </span>
          </div>
        )}
      </Link>

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
            {product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"}
          </p>
        )}

        <button
          type="button"
          onClick={() => setIsPopupOpen(true)}
          disabled={displayStock === 0}
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200",
            displayStock === 0
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : isInCart
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
              : "bg-primary text-white shadow-md hover:bg-primary/90"
          )}
        >
          {displayStock === 0 ? null : isInCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {displayStock === 0 ? "Out of Stock" : isInCart ? "Added to Cart" : "Add to Cart"}
        </button>
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
