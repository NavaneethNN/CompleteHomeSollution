"use client";

import { useState, useCallback } from "react";
import { Star } from "lucide-react";
import Link from "next/link";
import { ProductGallery } from "./product-gallery";
import { ProductAssurance } from "./product-assurance";
import { VariantSelector } from "./variant-selector";
import { AddToCartButton } from "./add-to-cart-button";
import { WishlistToggleButton } from "./wishlist-toggle-button";
import { resolveMemberPrice } from "@/lib/member-price";

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
  isPrimary: boolean;
  variantValues: {
    id: string;
    value: string;
    hexCode: string | null;
    images: string[];
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

  // Image priority:
  // 1. Variant has its own images → use them
  // 2. No variant images but a primary attribute is set → use that primary value's images
  // 3. Fallback to product-level images
  const variantOwnImages = selectedVariant?.images?.map((i) => i.url) ?? [];
  const primaryAttr = attributes.find((a) => a.isPrimary);
  const primaryValueId = primaryAttr
    ? selectedVariant?.values.find(
        (v) => v.variantValue.variantAttribute.id === primaryAttr.id
      )?.variantValue?.id
    : undefined;
  const primaryValueImages = primaryAttr && primaryValueId
    ? (primaryAttr.variantValues.find((v) => v.id === primaryValueId)?.images ?? [])
    : [];
  const displayImages =
    variantOwnImages.length > 0
      ? variantOwnImages
      : primaryValueImages.length > 0
        ? primaryValueImages
        : product.images;
  const displayPrice = selectedVariant?.price ?? product.basePrice;
  const displayComparePrice = selectedVariant?.comparePrice ?? product.comparePrice;
  const displayMemberPrice = resolveMemberPrice(displayPrice, selectedVariant?.memberPrice, product.memberPrice);
  const displayStock = selectedVariant?.stock ?? product.stock;
  const displaySku = selectedVariant?.sku ?? product.sku;

  // Dimensions — variant values override product-level values
  const displayWeight = selectedVariant?.weight ?? product.weight;
  const displayLength = selectedVariant?.length ?? product.length;
  const displayWidth  = selectedVariant?.width  ?? product.width;
  const displayHeight = selectedVariant?.height ?? product.height;
  const hasDimensions = displayWeight || (displayLength && displayWidth && displayHeight);

  // Generate variant label from selected variant's attribute values
  const variantLabel = selectedVariant?.values
    ?.map((v) => v.variantValue.value)
    .join(" / ");
  const money = (amount: number) => amount.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

  const handleVariantChange = useCallback((variant: ProductVariant | null) => {
    setSelectedVariant(variant);
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(390px,0.88fr)] lg:items-start lg:gap-12 xl:gap-16">
      <div className="min-w-0 lg:sticky lg:top-24">
        <ProductGallery images={displayImages} productName={product.name} key={selectedVariant?.id || "default"} />
        {product.slug === "recliner-sofa" && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Images are for reference. Colour and size options do not yet have separate product photos.</p>
        )}
      </div>

      <div className="min-w-0 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {product.category?.slug && <Link href={`/categories/${product.category.slug}`} className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary hover:underline">{product.category.name}</Link>}
            <h1 className="mt-2 text-3xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-4xl">{product.name}</h1>
            {product.material && <p className="mt-2 text-sm text-muted-foreground">Material: {product.material}</p>}
          </div>
          <WishlistToggleButton product={{ id: product.id, name: product.name, slug: product.slug, sku: displaySku, price: displayPrice, comparePrice: displayComparePrice, memberPrice: displayMemberPrice, images: displayImages, stock: displayStock, description: product.description, material: product.material, category: product.category ?? { name: "", slug: "" }, variantId: selectedVariant?.id ?? null, variantLabel }} className="h-11 w-11 shrink-0" />
        </div>

        {product.avgRating != null && product.reviewCount != null && product.reviewCount > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">{product.avgRating.toFixed(1)}</span>
            <span className="text-muted-foreground">({product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"})</span>
          </div>
        )}

        <div className="mt-6 border-b border-border pb-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className="text-3xl font-semibold tracking-tight text-foreground">{money(displayPrice)}</span>
            {displayComparePrice != null && displayComparePrice > displayPrice && (
              <><span className="text-base text-muted-foreground line-through">{money(displayComparePrice)}</span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Save {Math.round(((displayComparePrice - displayPrice) / displayComparePrice) * 100)}%</span></>
            )}
          </div>
          {displayMemberPrice != null && displayMemberPrice < displayPrice && (
            <p className="mt-3 text-sm text-muted-foreground"><span className="font-semibold text-primary">{money(displayMemberPrice)} member price</span> · save {money(displayPrice - displayMemberPrice)}</p>
          )}
        </div>

        <p className="mt-6 text-sm leading-7 text-muted-foreground sm:text-base">{product.description.trim() || "Choose the size and colour that suit your space. Review the selected option and delivery availability before checkout."}</p>
        <div className="mt-6">
          <VariantSelector attributes={attributes} variants={variants} variantMap={variantMap} defaultVariant={defaultVariant} onVariantChange={handleVariantChange} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={displayStock > 0 ? "font-medium text-emerald-800" : "font-medium text-destructive"}>{displayStock > 0 ? `In stock · ${displayStock} available` : "Out of stock"}</span>
          <span className="text-xs text-muted-foreground">SKU {displaySku}</span>
        </div>
        <div className="mt-4">
          <AddToCartButton product={{ id: product.id, name: product.name, slug: product.slug, sku: displaySku, price: displayPrice, memberPrice: displayMemberPrice, images: displayImages, stock: displayStock, description: product.description, variantId: selectedVariant?.id ?? null, variantLabel }} disabled={displayStock <= 0} hasVariants />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">Shipping options are calculated from your address at checkout.</p>

        {hasDimensions && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="text-base font-semibold text-foreground">Product details</h2>
            <dl className="mt-3 divide-y divide-border/70 text-sm">
              {product.material && <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Material</dt><dd className="text-right font-medium text-foreground">{product.material}</dd></div>}
              {displayWeight != null && <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Estimated package weight</dt><dd className="text-right font-medium text-foreground">{displayWeight} kg</dd></div>}
              {displayLength != null && displayWidth != null && displayHeight != null && <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Estimated package size (L × W × H)</dt><dd className="text-right font-medium text-foreground">{displayLength} × {displayWidth} × {displayHeight} cm</dd></div>}
            </dl>
          </div>
        )}
        <div className="mt-7"><ProductAssurance /></div>
      </div>
    </div>
  );
}
