"use client";

import { useState, useCallback, useRef } from "react";
import { Star, Check, PhoneCall, Sparkles } from "lucide-react";
import { STORE_PHONE, STORE_PHONE_DISPLAY } from "@/lib/store-info";
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
  description?: string | null;
  bulletTitle?: string | null;
  bulletPoints?: string[];
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
    bulletTitle?: string | null;
    bulletPoints?: string[];
    material: string | null;
    weight?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    category?: { name: string; slug: string };
    isPreOrder?: boolean;
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

  // Description & Highlights fallback: variant specific takes precedence, falling back to product level
  const displayDescription = selectedVariant?.description?.trim()
    ? selectedVariant.description
    : (product.description?.trim() || "Choose the size and colour that suit your space. Review the selected option and delivery availability before checkout.");

  const hasVariantBullets = !!(selectedVariant?.bulletPoints && selectedVariant.bulletPoints.length > 0);
  const displayBulletPoints = hasVariantBullets
    ? selectedVariant!.bulletPoints!
    : (product.bulletPoints && product.bulletPoints.length > 0 ? product.bulletPoints : []);
  const displayBulletTitle = (hasVariantBullets ? selectedVariant?.bulletTitle : product.bulletTitle)?.trim() || "Key Features";

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

  const galleryRef = useRef<HTMLDivElement>(null);

  const handleVariantChange = useCallback((variant: ProductVariant | null) => {
    setSelectedVariant(variant);

    // If gallery is scrolled out of view on mobile/tablet, smoothly scroll back to it
    // so the customer immediately sees the updated product photo
    if (typeof window !== "undefined" && galleryRef.current) {
      const rect = galleryRef.current.getBoundingClientRect();
      if (rect.top < 30) {
        galleryRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  return (
    <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(390px,0.88fr)] lg:items-start lg:gap-12 xl:gap-16">
      <div ref={galleryRef} id="product-gallery-section" className="min-w-0 lg:sticky lg:top-24">
        <ProductGallery images={displayImages} productName={product.name} key={selectedVariant?.id || "default"} />
        {product.slug === "recliner-sofa" && (
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">Images are for reference. Colour and size options do not yet have separate product photos.</p>
        )}
      </div>

      <div className="min-w-0 pb-4 space-y-4 sm:space-y-5">
        {/* Header: Category, Title, Material & Wishlist */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {product.category?.slug && (
              <Link
                href={`/categories/${product.category.slug}`}
                className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary hover:underline"
              >
                {product.category.name}
              </Link>
            )}
            <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl lg:text-4xl leading-snug">
              {product.name}
            </h1>
            {product.material && (
              <p className="mt-1 text-xs text-muted-foreground">Material: {product.material}</p>
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
              description: displayDescription,
              material: product.material,
              category: product.category ?? { name: "", slug: "" },
              variantId: selectedVariant?.id ?? null,
              variantLabel,
            }}
            className="h-10 w-10 sm:h-11 sm:w-11 shrink-0"
          />
        </div>

        {/* Rating */}
        {product.avgRating != null && product.reviewCount != null && product.reviewCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">{product.avgRating.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}

        {/* Pricing (hidden for pre-order custom products) */}
        {!product.isPreOrder && (
          <div className="border-y border-border/70 py-3 sm:py-4">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {money(displayPrice)}
              </span>
              {displayComparePrice != null && displayComparePrice > displayPrice && (
                <>
                  <span className="text-sm sm:text-base text-muted-foreground line-through">
                    {money(displayComparePrice)}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Save {Math.round(((displayComparePrice - displayPrice) / displayComparePrice) * 100)}%
                  </span>
                </>
              )}
            </div>
            {displayMemberPrice != null && displayMemberPrice < displayPrice && (
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
                <span className="font-semibold text-primary">{money(displayMemberPrice)} member price</span>
                {" · "}save {money(displayPrice - displayMemberPrice)}
              </p>
            )}
          </div>
        )}

        {/* Variant Selector — Positioned immediately under price so mobile customers don't have to scroll */}
        <div className="pt-0.5">
          <div className="flex items-center justify-between mb-1 sm:hidden">
            <span className="text-[11px] font-medium text-muted-foreground">Options & Variants</span>
            <button
              type="button"
              onClick={() => galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              View photo ↑
            </button>
          </div>
          <VariantSelector
            attributes={attributes}
            variants={variants}
            variantMap={variantMap}
            defaultVariant={defaultVariant}
            onVariantChange={handleVariantChange}
          />
        </div>

        {/* Stock & SKU */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm pt-1">
          {product.isPreOrder ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Pre-Order Only • Custom Made to Order
            </span>
          ) : (
            <span className={displayStock > 0 ? "font-medium text-emerald-800" : "font-medium text-destructive"}>
              {displayStock > 0 ? `● In stock (${displayStock} available)` : "● Out of stock"}
            </span>
          )}
          <span className="text-xs text-muted-foreground">SKU: {displaySku}</span>
        </div>

        {/* Add to Cart or Call & Customize Button */}
        {product.isPreOrder ? (
          <div className="space-y-2">
            <a
              href={`tel:${STORE_PHONE}`}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-md transition-all duration-200 hover:scale-[1.01]"
            >
              <PhoneCall className="h-4 w-4" />
              Call & Customize
            </a>
            <p className="text-center text-[11px] sm:text-xs text-muted-foreground">
              This product is built to order. Call us directly ({STORE_PHONE_DISPLAY}) to discuss custom sizes, materials, and delivery.
            </p>
          </div>
        ) : (
          <>
            <div>
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
                  description: displayDescription,
                  variantId: selectedVariant?.id ?? null,
                  variantLabel,
                }}
                disabled={displayStock <= 0}
                hasVariants
              />
            </div>
            <p className="text-center text-[11px] sm:text-xs text-muted-foreground">
              Shipping options are calculated from your address at checkout.
            </p>
          </>
        )}

        {/* Description & Key Features */}
        <div className="border-t border-border/70 pt-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h2>
          <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground sm:leading-6">
            {displayDescription}
          </p>

          {displayBulletPoints.length > 0 && (
            <div className="mt-3 rounded-xl border border-border/70 bg-slate-50/70 p-3.5 space-y-2">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {displayBulletTitle}
              </h3>
              <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                {displayBulletPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Dimensions & Specifications */}
        {hasDimensions && (
          <div className="border-t border-border/70 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dimensions & Weight</h2>
            <dl className="mt-2.5 divide-y divide-border/60 text-xs sm:text-sm">
              {product.material && (
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Material</dt>
                  <dd className="text-right font-medium text-foreground">{product.material}</dd>
                </div>
              )}
              {displayWeight != null && (
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Estimated package weight</dt>
                  <dd className="text-right font-medium text-foreground">{displayWeight} kg</dd>
                </div>
              )}
              {displayLength != null && displayWidth != null && displayHeight != null && (
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Estimated package dimensions (L × W × H)</dt>
                  <dd className="text-right font-medium text-foreground">{displayLength} × {displayWidth} × {displayHeight} cm</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Product Assurance */}
        <div className="pt-2">
          <ProductAssurance />
        </div>
      </div>
    </div>
  );
}
