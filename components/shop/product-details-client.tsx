"use client";

import { useState, useCallback } from "react";
import { ProductGallery } from "./product-gallery";
import { VariantSelector } from "./variant-selector";
import { AddToCartButton } from "./add-to-cart-button";

interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  comparePrice: number | null;
  memberPrice: number | null;
  stock: number;
  isActive: boolean;
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
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Model, Size, Color</p>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground mt-0.5">
            {product.name}
          </h1>
          {product.material && (
            <p className="text-xs text-muted-foreground mt-0.5">{product.material}</p>
          )}
        </div>

        {/* Pricing */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold text-foreground">
            ${displayPrice.toLocaleString()}
          </span>
          {displayComparePrice && displayComparePrice > displayPrice && (
            <span className="text-sm text-muted-foreground line-through">
              ${displayComparePrice.toLocaleString()}
            </span>
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
            <span className="text-green-600">● In Stock</span>
          ) : (
            <span className="text-destructive">Out of Stock</span>
          )}
        </div>

        {/* Add to Cart */}
        <AddToCartButton
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: displayPrice,
            memberPrice: displayMemberPrice,
            images: displayImages,
            stock: displayStock,
            description: product.description,
            variantId: selectedVariant?.id ?? null,
          }}
          disabled={displayStock === 0}
          hasVariants={true}
        />

        {/* Trust Badges */}
        <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          <span>Free Delivery</span>
          <span>•</span>
          <span>30 Day Returns</span>
          <span>•</span>
          <span>2 Year Warranty</span>
        </div>
      </div>
    </div>
  );
}
