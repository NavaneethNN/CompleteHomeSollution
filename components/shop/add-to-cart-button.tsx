"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import {
  ProductPopupModal,
  type ProductPopupModalProduct,
} from "./product-popup-modal";

interface AddToCartButtonProps {
  product: ProductPopupModalProduct;
  disabled?: boolean;
  hasVariants?: boolean;
}

export function AddToCartButton({
  product,
  disabled = false,
  hasVariants = false,
}: AddToCartButtonProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isAddedRaw = useCartStore((state) => state.isInCart(product.id, product.variantId ?? null));
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => { setMounted(true); }, []);

  // Before hydration completes, always render the "not added" state to match SSR
  const isAdded = mounted && isAddedRaw;

  // If variant is selected (variantId exists), show "Add to Cart", otherwise "Choose Options"
  const hasSelectedVariant = product.variantId !== null && product.variantId !== undefined;
  const buttonText = disabled 
    ? "Out of Stock" 
    : hasVariants && !hasSelectedVariant 
      ? "Choose Options" 
      : "Add to Cart";

  const handleAddToCart = () => {
    if (hasVariants && !hasSelectedVariant) {
      // Show popup only if variants exist but none selected
      setIsPopupOpen(true);
    } else {
      // Add directly to cart
      addItem(product, 1);
    }
  };

  const handleConfirm = (quantity: number) => {
    addItem(product, quantity);
  };

  return (
    <>
      <button
        onClick={handleAddToCart}
        disabled={disabled}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200",
          "flex items-center justify-center gap-2",
          disabled
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : isAdded
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
        )}
      >
        {isAdded ? (
          <>
            <Check className="w-4 h-4" />
            Added to Cart
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4" />
            {buttonText}
          </>
        )}
      </button>

      <ProductPopupModal
        open={isPopupOpen}
        onOpenChange={setIsPopupOpen}
        product={product}
        onConfirm={handleConfirm}
        confirmLabel={hasSelectedVariant ? "Add to Cart" : "Add Selected Item"}
      />
    </>
  );
}
