"use client";

import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cart";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CartUpsellProps {
  isMember?: boolean;
}

interface UpsellProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  memberPrice?: number | null;
  images: string[];
  category: string;
  tag: string;
}

export function CartUpsell({ isMember = false }: CartUpsellProps) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const [upsells, setUpsells] = useState<UpsellProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUpsells() {
      if (items.length === 0) {
        setLoading(false);
        return;
      }

      try {
        // Fetch complementary products based on cart items
        const productIds = items.map(item => item.product.id).join(",");
        
        const response = await fetch(
          `/api/products/upsells?basedOn=${productIds}&exclude=${items.map(i => i.product.id).join(",")}&limit=3`
        );
        
        if (response.ok) {
          const data = await response.json();
          setUpsells(data.products || []);
        }
      } catch (error) {
        console.error("Failed to fetch upsells:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUpsells();
  }, [items]);

  if (loading || upsells.length === 0) return null;

  const handleAddToCart = (product: UpsellProduct) => {
    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      memberPrice: product.memberPrice,
      images: product.images,
      stock: 10, // Assume in stock for upsells
    });
  };

  return (
    <div className="mt-6 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-foreground">Complete Your Look</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Customers who bought these items also added:
      </p>

      <div className="space-y-3">
        {upsells.map((product) => {
          const effectivePrice = isMember && product.memberPrice 
            ? product.memberPrice 
            : product.price;
          
          const savings = isMember && product.memberPrice 
            ? product.price - product.memberPrice 
            : 0;

          return (
            <div 
              key={product.id}
              className="flex gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <Link 
                href={`/products/${product.slug}`}
                className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0"
              >
                <Image
                  src={product.images[0] || "/placeholder.jpg"}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </Link>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block text-[10px] font-semibold tracking-wide text-primary uppercase bg-primary/10 px-2 py-0.5 rounded mb-1">
                      {product.tag}
                    </span>
                    <Link 
                      href={`/products/${product.slug}`}
                      className="block text-sm font-medium text-foreground hover:text-primary line-clamp-2 transition-colors"
                    >
                      {product.name}
                    </Link>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      ${effectivePrice.toLocaleString()}
                    </p>
                    {savings > 0 && (
                      <p className="text-xs text-green-600">
                        Save ${savings.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddToCart(product)}
                  className="mt-2 h-8 text-xs border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                  Add to Cart
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href="/products"
        className="flex items-center justify-center gap-1.5 mt-4 text-sm font-medium text-primary hover:underline"
      >
        Browse more products
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
