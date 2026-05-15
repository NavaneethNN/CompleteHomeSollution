"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart, Zap } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { cn } from "@/lib/utils";
import { WishlistToggleButton } from "./wishlist-toggle-button";

interface HomeTrendingProductCardProps {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly price: number;
    readonly originalPrice: number;
    readonly discount: string | null;
    readonly reviews: number;
    readonly img: string;
    readonly description: string;
    readonly memberPrice: number | null;
    readonly stock: number;
    readonly category: { name: string; slug: string };
    readonly variantId?: string | null;
    readonly sku?: string | null;
    readonly variantLabel?: string;
    readonly hasVariants?: boolean;
  };
}

export function HomeTrendingProductCard({ product }: HomeTrendingProductCardProps) {
  const router = useRouter();
  const isInCart = useCartStore((state) => state.isInCart(product.id, null));
  const addItem = useCartStore((state) => state.addItem);
  const outOfStock = product.stock <= 0;

  const handleAddToCart = () => {
    if (outOfStock) {
      return;
    }

    addItem(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        price: product.price,
        memberPrice: product.memberPrice,
        images: [product.img],
        stock: product.stock,
        description: product.description,
        variantId: product.variantId ?? null,
        variantLabel: product.variantLabel,
      },
      1
    );
  };

  const handleBuyNow = () => {
    if (outOfStock) {
      return;
    }

    addItem(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        price: product.price,
        memberPrice: product.memberPrice,
        images: [product.img],
        stock: product.stock,
        description: product.description,
        variantId: product.variantId ?? null,
        variantLabel: product.variantLabel,
      },
      1
    );

    router.push("/checkout");
  };

  let addToCartClassName = "bg-primary text-white hover:bg-primary/90 shadow-md";
  let addToCartLabel = "Add to Cart";
  let addToCartIcon: React.ReactNode = <ShoppingCart className="h-3.5 w-3.5" />;

  if (outOfStock) {
    addToCartClassName = "cursor-not-allowed bg-muted text-muted-foreground";
    addToCartLabel = "Out of Stock";
    addToCartIcon = null;
  } else if (isInCart) {
    addToCartClassName = "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100";
    addToCartLabel = "Added";
    addToCartIcon = <Check className="h-3.5 w-3.5" />;
  }

  const buyNowClassName = outOfStock
    ? "cursor-not-allowed border border-border bg-muted text-muted-foreground"
    : "border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-white";

  const wishlistProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.price,
    comparePrice: product.originalPrice,
    memberPrice: product.memberPrice,
    images: [product.img],
    stock: product.stock,
    description: product.description,
    category: product.category,
    variantId: product.variantId ?? null,
    variantLabel: product.variantLabel,
  };

  return (
    <div className="group block">
      <div className="bg-white rounded-2xl border border-border hover:shadow-xl transition-shadow duration-300 overflow-hidden">
        <div className="relative aspect-square bg-secondary overflow-hidden">
          <Link href={`/products/${product.slug}`} className="absolute inset-0 block">
          <Image
            src={product.img}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          </Link>
          {product.discount && (
            <span className="absolute top-3 left-3 z-10 bg-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
              {product.discount}
            </span>
          )}
          <WishlistToggleButton
            product={wishlistProduct}
            className="absolute top-3 right-3 z-10 h-9 w-9"
          />
          {outOfStock && (
            <div className="absolute inset-0 z-0 flex items-center justify-center bg-black/50">
              <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-foreground">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          <Link href={`/categories/${product.category.slug}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
            {product.category.name}
          </Link>

          <Link href={`/products/${product.slug}`}>
            <h4 className="mt-1 text-sm font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors">
              {product.name}
            </h4>
          </Link>

          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {product.description}
          </p>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-base font-black text-foreground">${product.price.toLocaleString()}</span>
            {product.originalPrice > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                ${product.originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          {/* Stock indicator */}
          {product.stock > 0 && product.stock <= 5 && (
            <p className="mt-2 text-xs text-amber-600 font-medium">
              Only {product.stock} left!
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={outOfStock}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors",
                addToCartClassName
              )}
            >
              {addToCartIcon}
              {addToCartLabel}
            </button>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={outOfStock}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors",
                buyNowClassName
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

