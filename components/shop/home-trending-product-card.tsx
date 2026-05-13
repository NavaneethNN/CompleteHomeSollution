"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart, Zap } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { cn } from "@/lib/utils";

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
        price: product.price,
        memberPrice: product.memberPrice,
        images: [product.img],
        stock: product.stock,
        description: product.description,
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
        price: product.price,
        memberPrice: product.memberPrice,
        images: [product.img],
        stock: product.stock,
        description: product.description,
      },
      1
    );

    router.push("/checkout");
  };

  let addToCartClassName = "bg-primary text-white hover:bg-primary/90 shadow-md";
  let addToCartLabel = "Add to Cart";
  let addToCartIcon = <ShoppingCart className="h-3.5 w-3.5" />;

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

  return (
    <div className="group block">
      <div className="bg-white rounded-2xl border border-border hover:shadow-xl transition-shadow duration-300 overflow-hidden">
        <Link href={`/products/${product.slug}`} className="relative block aspect-square bg-secondary overflow-hidden">
          <Image
            src={product.img}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {product.discount && (
            <span className="absolute top-3 left-3 bg-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-full z-10">
              {product.discount}
            </span>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-foreground">
                Out of Stock
              </span>
            </div>
          )}
        </Link>

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
