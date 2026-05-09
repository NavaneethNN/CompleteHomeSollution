"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddToCartButtonProps {
  productId: string;
  variantId?: string;
  disabled?: boolean;
  hasVariants?: boolean;
}

export function AddToCartButton({
  productId,
  variantId,
  disabled = false,
  hasVariants = false,
}: AddToCartButtonProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    // TODO: Implement cart logic
    console.log("Adding to cart:", { productId, variantId, quantity });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Quantity Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Quantity:</span>
        <div className="flex items-center border border-border rounded-lg">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-2 hover:bg-muted transition-colors"
            disabled={disabled}
          >
            -
          </button>
          <span className="px-4 py-2 font-medium min-w-[3rem] text-center">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="px-3 py-2 hover:bg-muted transition-colors"
            disabled={disabled}
          >
            +
          </button>
        </div>
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={disabled}
        className={cn(
          "w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200",
          "flex items-center justify-center gap-3",
          disabled
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : isAdded
            ? "bg-green-600 text-white"
            : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg"
        )}
      >
        {isAdded ? (
          <>
            <Check className="w-5 h-5" />
            Added to Cart!
          </>
        ) : (
          <>
            <ShoppingCart className="w-5 h-5" />
            {disabled ? "Out of Stock" : hasVariants ? "Select Options & Add to Cart" : "Add to Cart"}
          </>
        )}
      </button>

      {/* Wishlist Button (optional) */}
      <button className="w-full py-3 px-6 rounded-xl border border-border font-medium text-foreground hover:bg-muted transition-colors">
        Add to Wishlist
      </button>
    </div>
  );
}
