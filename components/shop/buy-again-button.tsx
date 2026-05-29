"use client";

import { useState } from "react";
import { ShoppingCart, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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

  const handleBuyAgain = async () => {
    setLoading(true);
    setSuccess(false);
    
    try {
      // Add each item to cart
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const res = await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: item.product.id,
              variantId: item.productVariantId || undefined,
              quantity: item.quantity,
            }),
          });
          
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Failed to add ${item.product.name}`);
          }
          
          return res.json();
        })
      );

      const failed = results.filter((r) => r.status === "rejected");
      const succeeded = results.filter((r) => r.status === "fulfilled");

      if (failed.length > 0) {
        console.error("Some items failed to add:", failed);
      }

      if (succeeded.length > 0) {
        setSuccess(true);
        toast.success(`${succeeded.length} item(s) added to cart`, {
          action: {
            label: "View Cart",
            onClick: () => router.push("/cart"),
          },
        });
        
        // Reset success state after 2 seconds
        setTimeout(() => setSuccess(false), 2000);
      } else {
        toast.error("Failed to add items to cart");
      }
    } catch (error) {
      console.error("Buy again error:", error);
      toast.error("Something went wrong. Please try again.");
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
