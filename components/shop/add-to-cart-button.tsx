"use client";

import { useState } from "react";
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
  const isAdded = useCartStore((state) => state.isInCart(product.id, product.variantId ?? null));
  const addItem = useCartStore((state) => state.addItem);

  const handleConfirm = (quantity: number) => {
    addItem(product, quantity);
  };

  return (
    <>
      <button
        onClick={() => setIsPopupOpen(true)}
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
            {disabled ? "Out of Stock" : hasVariants ? "Choose Options" : "Add to Cart"}
          </>
        )}
      </button>

      <ProductPopupModal
        open={isPopupOpen}
        onOpenChange={setIsPopupOpen}
        product={product}
        onConfirm={handleConfirm}
        confirmLabel={hasVariants ? "Add Selected Item" : "Add to Cart"}
      />
    </>
  );
}
