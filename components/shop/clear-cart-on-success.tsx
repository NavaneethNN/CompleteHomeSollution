"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart";

export function ClearCartOnSuccess({ orderId, purchasedItems }: {
  orderId: string;
  purchasedItems: { productId: string; productVariantId: string | null; quantity: number }[];
}) {
  useEffect(() => {
    const key = `chs-cart-cleared:${orderId}`;
    if (sessionStorage.getItem(key)) return;
    const cart = useCartStore.getState();
    for (const item of purchasedItems) {
      const quantity = cart.getItemQuantity(item.productId, item.productVariantId);
      if (quantity > 0) cart.updateQuantity(item.productId, quantity - item.quantity, item.productVariantId);
    }
    sessionStorage.setItem(key, "1");
  }, [orderId, purchasedItems]);
  return null;
}
