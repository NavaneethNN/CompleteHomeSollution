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
      <div className="container mx-auto px-4 py-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: product.category.name, href: `/categories/${product.category.slug}` },
            { label: product.name },
          ]}
        />
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Gallery */}
          <ProductGallery images={displayImages} productName={product.name} />

          {/* Product Info */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <p className="text-sm text-muted-foreground">{product.category.name}</p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-1">
                {product.name}
              </h1>
              {product.material && (
                <p className="text-sm text-muted-foreground mt-1">{product.material}</p>
              )}
            </div>

            {/* Pricing */}
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">
                ${displayPrice.toLocaleString()}
              </span>
              {displayComparePrice && displayComparePrice > displayPrice && (
                <>
                  <span className="text-xl text-muted-foreground line-through">
                    ${displayComparePrice.toLocaleString()}
                  </span>
                  <span className="px-2 py-1 bg-destructive/10 text-destructive text-sm font-medium rounded">
                    Save ${(displayComparePrice - displayPrice).toLocaleString()}
                  </span>
                </>
              )}
            </div>

            {/* Member Price */}
            {displayMemberPrice && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-primary font-medium">
                  Member Price: ${displayMemberPrice.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Join our membership program to save ${(displayPrice - displayMemberPrice).toLocaleString()}
                </p>
              </div>
            )}

            {/* Description */}
            <p className="text-muted-foreground leading-relaxed">{product.description}</p>

            {/* Variant Selector */}
            {product.hasVariants && (
              <VariantSelector
                attributes={product.variantAttributes}
                variants={product.productVariants}
                variantMap={product.variantMap}
                defaultVariant={defaultVariant}
              />
            )}

            {/* Stock & SKU */}
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">SKU:</span>{" "}
                <span className="font-medium">{defaultVariant?.sku ?? product.sku}</span>
              </div>
              {(defaultVariant?.stock ?? product.stock) > 0 ? (
                <div className="text-green-600 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  In Stock ({defaultVariant?.stock ?? product.stock} available)
                </div>
              ) : (
                <div className="text-destructive font-medium">Out of Stock</div>
              )}
            </div>

            {/* Add to Cart */}
            <AddToCartButton
              productId={product.id}
              variantId={defaultVariant?.id}
              disabled={(defaultVariant?.stock ?? product.stock) === 0}
              hasVariants={product.hasVariants}
            />

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 py-4 border-t border-border">
              <div className="text-center">
                <p className="font-medium text-sm">Free Delivery</p>
                <p className="text-xs text-muted-foreground">Australia-wide</p>
              </div>
              <div className="text-center border-x border-border">
                <p className="font-medium text-sm">30 Day Returns</p>
                <p className="text-xs text-muted-foreground">Easy returns</p>
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">2 Year Warranty</p>
                <p className="text-xs text-muted-foreground">Quality guaranteed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <ProductReviews reviews={product.reviews} reviewCount={product._count.reviews} />
      </div>
    </main>
  );
}

