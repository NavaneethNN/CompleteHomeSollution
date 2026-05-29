import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProductGallery } from "@/components/shop/product-gallery";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { ProductReviews } from "@/components/shop/product-reviews";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductDetailsClient } from "@/components/shop/product-details-client";
import { RecommendedProducts } from "@/components/shop/recommended-products";
import { WishlistToggleButton } from "@/components/shop/wishlist-toggle-button";
import { Truck, RotateCcw, ShieldCheck, Star } from "lucide-react";

export const revalidate = 3600;

async function getProduct(slug: string) {
  // Security: validate slug format to prevent injection
  if (!/^[a-z0-9-]+$/.test(slug)) return null;

  const product = await db.product.findUnique({
    where: { slug, isActive: true },
    include: {
      category: true,
      variantAttributes: {
        orderBy: { displayOrder: "asc" },
        include: {
          variantValues: {
            orderBy: { value: "asc" },
            select: {
              id: true,
              value: true,
              hexCode: true,
              images: true,
              variantAttributeId: true,
            },
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
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          comment: true,
          images: true,
          createdAt: true,
          user: { select: { name: true, image: true } },
        },
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
}: Readonly<{
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return notFound();
  }

  // Default to first variant if product has variants
  const defaultVariant = product.hasVariants ? product.productVariants[0] : null;

  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : null;

  const wishlistProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.basePrice ?? 0,
    comparePrice: product.comparePrice ?? null,
    memberPrice: product.memberPrice ?? null,
    images: product.images?.length ? product.images : ["/placeholder.jpg"],
    stock: product.stock ?? 0,
    description: product.description ?? "",
    material: product.material ?? null,
    category: { name: product.category.name, slug: product.category.slug },
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 md:px-6 xl:px-8 py-3">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: product.category.name, href: `/categories/${product.category.slug}` },
            { label: product.name },
          ]}
        />
      </div>

      <div className="container mx-auto px-4 md:px-6 xl:px-8 pb-12 space-y-12">
        {/* ── Product Detail ── */}
        {product.hasVariants ? (
          <ProductDetailsClient
            product={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              slug: product.slug,
              basePrice: product.basePrice,
              comparePrice: product.comparePrice,
              memberPrice: product.memberPrice,
              stock: product.stock,
              images: product.images,
              description: product.description,
              material: product.material,
              weight: product.weight,
              length: product.length,
              width: product.width,
              height: product.height,
              category: { name: product.category.name, slug: product.category.slug },
              reviewCount: product._count.reviews,
              avgRating,
            }}
            attributes={product.variantAttributes}
            variants={product.productVariants}
            variantMap={product.variantMap}
            defaultVariant={defaultVariant}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
            <div className="w-full max-w-[480px] mx-auto md:mx-0">
              <ProductGallery images={product.images} productName={product.name} />
            </div>
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{product.category.name}</p>
                  <h1 className="text-xl md:text-2xl font-semibold text-foreground mt-0.5">{product.name}</h1>
                  {product.material && <p className="text-xs text-muted-foreground mt-0.5">{product.material}</p>}
                </div>
                <WishlistToggleButton product={wishlistProduct} className="h-9 w-9 shrink-0" />
              </div>

              {/* Rating summary */}
              {avgRating !== null && (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    {avgRating.toFixed(1)} ({product._count.reviews} {product._count.reviews === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-foreground">${product.basePrice.toLocaleString()}</span>
                {product.comparePrice && product.comparePrice > product.basePrice && (
                  <>
                    <span className="text-sm text-muted-foreground line-through">${product.comparePrice.toLocaleString()}</span>
                    <span className="text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                      Save {Math.round(((product.comparePrice - product.basePrice) / product.comparePrice) * 100)}%
                    </span>
                  </>
                )}
              </div>
              {product.memberPrice && (
                <p className="text-sm text-primary font-medium">
                  Member price: ${product.memberPrice.toLocaleString()}
                  <span className="text-xs text-muted-foreground font-normal ml-1">(Save ${(product.basePrice - product.memberPrice).toLocaleString()})</span>
                </p>
              )}

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>

              {/* SKU / Stock */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>SKU: {product.sku}</span>
                {product.stock > 0
                  ? <span className="text-green-600 font-medium">● In Stock ({product.stock} available)</span>
                  : <span className="text-destructive font-medium">● Out of Stock</span>}
              </div>

              {/* Add to Cart */}
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  price: product.basePrice ?? 0,
                  memberPrice: product.memberPrice ?? null,
                  images: product.images?.length ? product.images : ["/placeholder.jpg"],
                  stock: product.stock ?? 0,
                  description: product.description ?? "",
                }}
                disabled={!product.stock || product.stock <= 0}
                hasVariants={false}
              />

              {/* Specifications */}
              {(product.weight || product.length || product.width || product.height) && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Specifications</p>
                  <div className="grid grid-cols-1 gap-y-2 text-sm">
                    {product.weight && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weight</span>
                        <span className="font-medium">{product.weight} kg</span>
                      </div>
                    )}
                    {product.length && product.width && product.height && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dimensions</span>
                        <span className="font-medium">{product.length} × {product.width} × {product.height} cm</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Trust badges */}
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
        )}

        {/* ── Reviews Section ── */}
        <ProductReviews
          productId={product.id}
          reviews={product.reviews}
          reviewCount={product._count.reviews}
        />

        {/* ── Recommended Products ── */}
        <RecommendedProducts
          categoryId={product.categoryId}
          currentProductId={product.id}
        />
      </div>
    </main>
  );
}
