import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProductGallery } from "@/components/shop/product-gallery";
import { VariantSelector } from "@/components/shop/variant-selector";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { ProductReviews } from "@/components/shop/product-reviews";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";

export const revalidate = 3600;

async function getProduct(slug: string) {
  const product = await db.product.findUnique({
    where: { slug, isActive: true },
    include: {
      category: true,
      variantAttributes: {
        orderBy: { displayOrder: "asc" },
        include: {
          variantValues: {
            orderBy: { value: "asc" },
          },
        },
      },
      productVariants: {
        where: { isActive: true },
        include: {
          values: {
            include: {
              variantValue: {
                include: { variantAttribute: true },
              },
            },
          },
          images: {
            orderBy: { displayOrder: "asc" },
          },
        },
      },
      reviews: {
        include: { user: { select: { name: true, image: true } } },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { reviews: true } },
    },
  });

  if (!product) return null;

  return {
    ...product,
    // Group variants by their attribute combinations
    variantMap: product.productVariants.reduce((acc, variant) => {
      const key = variant.values
        .map((v) => `${v.variantValue.variantAttribute.name}:${v.variantValue.value}`)
        .join("|");
      acc[key] = variant;
      return acc;
    }, {} as Record<string, typeof product.productVariants[0]>),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  
  if (!product) {
    return { title: "Product Not Found" };
  }

  return {
    title: `${product.name} — Complete Home Sollution`,
    description: product.description.slice(0, 160),
    openGraph: {
      images: product.images[0] ? [{ url: product.images[0] }] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  // Default to first variant if product has variants
  const defaultVariant = product.hasVariants ? product.productVariants[0] : null;
  const displayImages = defaultVariant?.images.map((i) => i.url) ?? product.images;
  const displayPrice = defaultVariant?.price ?? product.basePrice;
  const displayComparePrice = defaultVariant?.comparePrice ?? product.comparePrice;
  const displayMemberPrice = defaultVariant?.memberPrice ?? product.memberPrice;

  return (
    <main className="min-h-screen bg-background">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 py-3">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: product.category.name, href: `/categories/${product.category.slug}` },
            { label: product.name },
          ]}
        />
      </div>

      <div className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Product Gallery */}
          <ProductGallery images={displayImages} productName={product.name} />

          {/* Product Info - Compact */}
          <div className="space-y-4">
            {/* Header */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{product.category.name}</p>
              <h1 className="text-xl md:text-2xl font-semibold text-foreground mt-0.5">
                {product.name}
              </h1>
              {product.material && (
                <p className="text-xs text-muted-foreground mt-0.5">{product.material}</p>
              )}
            </div>

            {/* Pricing - Inline */}
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

            {/* Member Price - Compact */}
            {displayMemberPrice && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-primary font-medium">Member: ${displayMemberPrice.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">(Save ${(displayPrice - displayMemberPrice).toLocaleString()})</span>
              </div>
            )}

            {/* Description - Shorter */}
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>

            {/* Variant Selector */}
            {product.hasVariants && (
              <VariantSelector
                attributes={product.variantAttributes}
                variants={product.productVariants}
                variantMap={product.variantMap}
                defaultVariant={defaultVariant}
              />
            )}

            {/* Stock & SKU - Compact */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>SKU: {defaultVariant?.sku ?? product.sku}</span>
              {(defaultVariant?.stock ?? product.stock) > 0 ? (
                <span className="text-green-600">● In Stock</span>
              ) : (
                <span className="text-destructive">Out of Stock</span>
              )}
            </div>

            {/* Add to Cart */}
            <AddToCartButton
              productId={product.id}
              variantId={defaultVariant?.id}
              disabled={(defaultVariant?.stock ?? product.stock) === 0}
              hasVariants={product.hasVariants}
            />

            {/* Trust Badges - Minimal */}
            <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
              <span>Free Delivery</span>
              <span>•</span>
              <span>30 Day Returns</span>
              <span>•</span>
              <span>2 Year Warranty</span>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <ProductReviews reviews={product.reviews} reviewCount={product._count.reviews} />
      </div>
    </main>
  );
}

