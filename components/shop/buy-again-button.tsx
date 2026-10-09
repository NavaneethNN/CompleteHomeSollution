"use client";

import { useState } from "react";
import { ShoppingCart, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart";

interface OrderItem {
  id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    images: string[];
  };
  productVariantId?: string | null;
  quantity: number;
  unitPrice: number;
  productVariant?: {
    id: string;
    sku: string;
    values?: {
      variantValue: {
        value: string;
        variantAttribute: {
          name: string;
        };
      };
    }[];
  } | null;
}

interface BuyAgainButtonProps {
  items: OrderItem[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function BuyAgainButton({
  items,
  variant = "default",
  size = "default",
  className,
}: BuyAgainButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  if (items.length === 0) return null;

  const handleBuyAgain = async () => {
    setLoading(true);
    setSuccess(false);
    
    try {
      const ids = [...new Set(items.map(item => item.product.id))];
      const response = await fetch("/api/cart/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!response.ok) throw new Error("Current product details could not be loaded");
      const { catalog } = await response.json();
      let addedCount = 0;
      let skippedCount = 0;

      for (const item of items) {
        const current = catalog[item.productVariantId ?? item.product.id];
        if (!current || current.id !== item.product.id || current.stock < 1) { skippedCount++; continue; }
        addItem(current, Math.min(item.quantity, current.stock));
        if (item.quantity > current.stock) skippedCount++;
        addedCount++;
      }

      if (addedCount > 0) {
        setSuccess(true);
        toast.success(`${addedCount} item(s) added to cart`, {
          action: {
            label: "View Cart",
            onClick: () => router.push("/cart"),
          },
        });
        if (skippedCount) toast.warning(`${skippedCount} item(s) were unavailable or had reduced stock.`);
        
        // Reset success state after 2 seconds
        setTimeout(() => setSuccess(false), 2000);
      } else {
        toast.error("These products or variants are no longer available");
      }
    } catch (error) {
      console.error("Buy again error:", error);
      toast.error("Current product details could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBuyAgain}
      disabled={loading || success}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Adding...
        </>
      ) : success ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Added!
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Buy Again
        </>
      )}
    </Button>
  );
}
