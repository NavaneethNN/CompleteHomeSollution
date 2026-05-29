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

  const handleBuyAgain = async () => {
    setLoading(true);
    setSuccess(false);
    
    try {
      // Small artificial delay to show feedback
      await new Promise(resolve => setTimeout(resolve, 600));

      let addedCount = 0;

      for (const item of items) {
        // Construct variant label if applicable
        const variantLabel = item.productVariant?.values
          ?.map((v) => `${v.variantValue.variantAttribute.name}: ${v.variantValue.value}`)
          .join(" · ");

        addItem({
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: item.unitPrice,
          images: item.product.images || [],
          stock: 99, // Allow adding to cart, stock will be verified at checkout
          variantId: item.productVariantId,
          variantLabel: variantLabel,
          sku: item.productVariant?.sku,
        }, item.quantity);
        
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
        
        // Reset success state after 2 seconds
        setTimeout(() => setSuccess(false), 2000);
      } else {
        toast.error("No items could be added to cart");
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
