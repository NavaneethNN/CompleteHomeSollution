import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { ShoppingCart } from "lucide-react";

interface RecommendedProductsProps {
  categoryId: string;
  currentProductId: string;
}

export async function RecommendedProducts({
  categoryId,
  currentProductId,
}: RecommendedProductsProps) {
  const products = await db.product.findMany({
    where: {
      categoryId,
      id: { not: currentProductId },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      basePrice: true,
      comparePrice: true,
      memberPrice: true,
      hasVariants: true,
      material: true,
      _count: { select: { reviews: true } },
      productVariants: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        take: 1,
        select: { price: true, comparePrice: true, stock: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  if (products.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">You May Also Like</h2>
          <p className="text-sm text-muted-foreground mt-0.5">More from the same collection</p>
        </div>
        <Link
          href="/products"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((product) => {
          const displayPrice =
            product.hasVariants && product.productVariants[0]
              ? product.productVariants[0].price
              : product.basePrice;
          const displayCompare =
            product.hasVariants && product.productVariants[0]
              ? product.productVariants[0].comparePrice
              : product.comparePrice;
          const hasDiscount =
            displayCompare && displayCompare > displayPrice;
          const discountPct = hasDiscount
            ? Math.round(((displayCompare - displayPrice) / displayCompare) * 100)
            : 0;

          return (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col"
            >
              <div className="relative aspect-[4/3] bg-muted overflow-hidden shrink-0">
                <Image
                  src={product.images[0] ?? "/placeholder.jpg"}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
                {hasDiscount && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-destructive text-white text-xs font-semibold rounded-md">
                    -{discountPct}%
                  </span>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <p className="text-xs text-muted-foreground line-clamp-1">{product.material}</p>
                <h3 className="mt-0.5 text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-foreground">
                    ${displayPrice.toLocaleString()}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-muted-foreground line-through">
                      ${displayCompare!.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="mt-auto pt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-primary/5 text-primary text-xs font-medium group-hover:bg-primary group-hover:text-white transition-colors">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  View Product
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
