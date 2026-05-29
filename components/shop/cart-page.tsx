"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import { useCartStore } from "@/store/cart";
import { CartItem } from "./cart-item";
import { CartSummary } from "./cart-summary";

interface CartPageProps {
  isMember?: boolean;
}

const emptyStateActions = [
  { label: "Continue Shopping", href: "/products" },
  { label: "Browse Categories", href: "/categories/living-room" },
];

export function CartPage({ isMember = false }: CartPageProps) {
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  const subtotal = useMemo(
    () => items.reduce((total, item) => {
      const basePrice = Math.max(0, item.product.price ?? 0);
      const memberPrice = item.product.memberPrice && item.product.memberPrice > 0 ? item.product.memberPrice : null;
      const effectivePrice = isMember && memberPrice !== null ? memberPrice : basePrice;
      return total + effectivePrice * item.quantity;
    }, 0),
    [items, isMember]
  );
  const fullSubtotal = useMemo(
    () => items.reduce((total, item) => total + Math.max(0, item.product.price ?? 0) * item.quantity, 0),
    [items]
  );
  const memberSavings = isMember ? fullSubtotal - subtotal : 0;


  if (items.length === 0) {
    return (
      <main className="bg-background py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 xl:px-8">
          <div className="mx-auto max-w-3xl rounded-2xl sm:rounded-[2rem] border border-border bg-white p-5 text-center shadow-sm sm:p-8 md:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-2xl font-black text-foreground sm:text-3xl md:text-4xl">Your cart is empty</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Add items to your cart from the product listing or product page to start building your order.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {emptyStateActions.map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={
                    index === 0
                      ? "inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary/90"
                      : "inline-flex items-center justify-center rounded-xl border-2 border-foreground px-6 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-foreground hover:text-white"
                  }
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-6 xl:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Shopping Cart</h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {items.reduce((t, i) => t + i.quantity, 0)} {items.reduce((t, i) => t + i.quantity, 0) === 1 ? "item" : "items"}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCart}
            className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline transition-colors"
          >
            Clear all
          </button>
        </div>

        <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="min-w-0 space-y-3 sm:space-y-4">
            {items.map((item, index) => {
              const itemKey = `${item.product.id ?? 'unknown'}-${item.product.variantId ?? 'default'}-${index}`;
              return (
                <CartItem
                  key={itemKey}
                  item={item}
                  isMember={isMember}
                  onUpdateQuantity={(quantity) => updateQuantity(item.product.id, quantity, item.product.variantId ?? null)}
                  onRemove={() => removeItem(item.product.id, item.product.variantId ?? null)}
                />
              );
            })}
          </section>

          <CartSummary
            subtotal={subtotal}
            itemCount={items.reduce((total, item) => total + item.quantity, 0)}
            isMember={isMember}
            memberSavings={memberSavings}
          />
        </div>
      </div>
    </main>
  );
}