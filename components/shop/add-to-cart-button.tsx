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
    console.log("Adding to cart:", { productId, variantId, quantity });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Quantity Selector - Compact */}
      <div className="flex items-center border border-border rounded-lg">
        <button
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="px-3 py-2.5 hover:bg-muted transition-colors text-sm"
          disabled={disabled}
        >
          -
        </button>
        <span className="px-3 py-2.5 font-medium min-w-[2.5rem] text-center text-sm">{quantity}</span>
        <button
          onClick={() => setQuantity((q) => q + 1)}
          className="px-3 py-2.5 hover:bg-muted transition-colors text-sm"
          disabled={disabled}
        >
          +
        </button>
      </div>

      {/* Add to Cart Button - Compact */}
      <button
        onClick={handleAddToCart}
        disabled={disabled}
        className={cn(
          "flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200",
          "flex items-center justify-center gap-2",
          disabled
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : isAdded
            ? "bg-green-600 text-white"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {isAdded ? (
          <>
            <Check className="w-4 h-4" />
            Added!
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4" />
            {disabled ? "Out of Stock" : "Add to Cart"}
          </>
        )}
      </button>
    </div>
  );
}
