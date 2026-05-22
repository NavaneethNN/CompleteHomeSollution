"use client";

import { useState, useCallback } from "react";
import { Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { ProductGallery } from "./product-gallery";
import { VariantSelector } from "./variant-selector";
import { AddToCartButton } from "./add-to-cart-button";
import { WishlistToggleButton } from "./wishlist-toggle-button";

interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  comparePrice: number | null;
  memberPrice: number | null;
  stock: number;
  isActive: boolean;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  values: {
    variantValue: {
      id: string;
      value: string;
      hexCode: string | null;
      variantAttribute: {
        id: string;
        name: string;
      };
    };
  }[];
  images: {
    id: string;
    url: string;
    displayOrder: number;
  }[];
}

interface VariantAttribute {
  id: string;
  name: string;
  displayOrder: number;
  variantValues: {
    id: string;
    value: string;
    hexCode: string | null;
  }[];
}

interface ProductDetailsClientProps {
  product: {
    id: string;
    name: string;
    sku: string;
    slug: string;
    basePrice: number;
    comparePrice: number | null;
    memberPrice: number | null;
    stock: number;
    images: string[];
    description: string;
    material: string | null;
    weight?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    category?: { name: string; slug: string };
    reviewCount?: number;
    avgRating?: number | null;
  };
  attributes: VariantAttribute[];
  variants: ProductVariant[];
  variantMap: Record<string, ProductVariant>;
  defaultVariant: ProductVariant | null;
}

export function ProductDetailsClient({
  product,
  attributes,
  variants,
  variantMap,
  defaultVariant,
}: ProductDetailsClientProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(defaultVariant);

  // Get images from selected variant or fallback to product images
  const displayImages = selectedVariant?.images?.map((i) => i.url) ?? product.images;
  const displayPrice = selectedVariant?.price ?? product.basePrice;
  const displayComparePrice = selectedVariant?.comparePrice ?? product.comparePrice;
  const displayMemberPrice = selectedVariant?.memberPrice ?? product.memberPrice;
  const displayStock = selectedVariant?.stock ?? product.stock;
  const displaySku = selectedVariant?.sku ?? product.sku;

  // Dimensions — variant values override product-level values
  const displayWeight = selectedVariant?.weight ?? product.weight;
  const displayLength = selectedVariant?.length ?? product.length;
  const displayWidth  = selectedVariant?.width  ?? product.width;
  const displayHeight = selectedVariant?.height ?? product.height;
  const hasDimensions = displayWeight || displayLength || displayWidth || displayHeight;

  // Generate variant label from selected variant's attribute values
  const variantLabel = selectedVariant?.values
    ?.map((v) => v.variantValue.value)
    .join(" / ");

  const handleVariantChange = useCallback((variant: ProductVariant | null) => {
    setSelectedVariant(variant);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
      {/* Product Gallery - Updates when variant changes */}
      <ProductGallery 
        images={displayImages} 
        productName={product.name} 
        key={selectedVariant?.id || 'default'} // Force re-render on variant change
      />

      {/* Product Info */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {product.category?.name ?? "Model, Size, Color"}
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground mt-0.5">
              {product.name}
            </h1>
            {product.material && (
              <p className="text-xs text-muted-foreground mt-0.5">{product.material}</p>
            )}
          </div>
          <WishlistToggleButton
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              sku: displaySku,
              price: displayPrice,
              comparePrice: displayComparePrice,
              memberPrice: displayMemberPrice,
              images: displayImages,
              stock: displayStock,
              description: product.description,
              material: product.material,
              category: product.category ?? { name: "", slug: "" },
            }}
            className="h-9 w-9 shrink-0"
          />
        </div>

        {/* Rating */}
        {product.avgRating != null && product.reviewCount != null && product.reviewCount > 0 && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className={`h-4 w-4 ${i < Math.round(product.avgRating!) ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/30"}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            ))}
            <span className="text-xs text-muted-foreground ml-1">
              {product.avgRating.toFixed(1)} ({product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}

        {/* Pricing */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-foreground">
            ${displayPrice.toLocaleString()}
          </span>
          {displayComparePrice && displayComparePrice > displayPrice && (
            <>
              <span className="text-sm text-muted-foreground line-through">
                ${displayComparePrice.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                Save {Math.round(((displayComparePrice - displayPrice) / displayComparePrice) * 100)}%
              </span>
            </>
          )}
        </div>

        {/* Member Price */}
        {displayMemberPrice && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-primary font-medium">Member: ${displayMemberPrice.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">(Save ${(displayPrice - displayMemberPrice).toLocaleString()})</span>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>

        {/* Variant Selector with Dynamic Filtering */}
        <VariantSelector
          attributes={attributes}
          variants={variants}
          variantMap={variantMap}
          defaultVariant={defaultVariant}
          onVariantChange={handleVariantChange}
        />

        {/* Stock & SKU */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>SKU: {displaySku}</span>
          {displayStock > 0 ? (
            <span className="text-green-600 font-medium">● In Stock ({displayStock} available)</span>
          ) : (
            <span className="text-destructive font-medium">● Out of Stock</span>
          )}
        </div>

        {/* Add to Cart */}
        <AddToCartButton
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            sku: displaySku,
            price: displayPrice,
            memberPrice: displayMemberPrice,
            images: displayImages,
            stock: displayStock,
            description: product.description,
            variantId: selectedVariant?.id ?? null,
            variantLabel,
          }}
          disabled={displayStock === 0}
          hasVariants={true}
        />

        {/* Weight & Dimensions */}
        {hasDimensions && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Specifications</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {displayWeight && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight</span>
                  <span className="font-medium text-foreground">{displayWeight} kg</span>
                </div>
              )}
              {(displayLength && displayWidth && displayHeight) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dimensions</span>
                  <span className="font-medium text-foreground">
                    {displayLength} × {displayWidth} × {displayHeight} cm
                  </span>
                </div>
              )}
              {displayLength && !(displayWidth && displayHeight) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Length</span>
                  <span className="font-medium text-foreground">{displayLength} cm</span>
                </div>
              )}
              {displayWidth && !(displayLength && displayHeight) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Width</span>
                  <span className="font-medium text-foreground">{displayWidth} cm</span>
                </div>
              )}
              {displayHeight && !(displayLength && displayWidth) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Height</span>
                  <span className="font-medium text-foreground">{displayHeight} cm</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trust Badges */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
          <div className="flex flex-col items-center gap-1 text-center p-2 rounded-lg bg-muted/50">
            <Truck className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Free Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-center p-2 rounded-lg bg-muted/50">
            <RotateCcw className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">30-Day Returns</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-center p-2 rounded-lg bg-muted/50">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">2-Year Warranty</span>
          </div>
        </div>
      </div>
    </div>
  );
}
