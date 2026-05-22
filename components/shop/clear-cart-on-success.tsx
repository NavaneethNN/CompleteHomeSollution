"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart";

export function ClearCartOnSuccess() {
  const clearCart = useCartStore((state) => state.clearCart);
  useEffect(() => {
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
