"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import { useCartStore } from "@/store/cart";
import { CartItem } from "./cart-item";
import { CartSummary } from "./cart-summary";

const emptyStateActions = [
  { label: "Continue Shopping", href: "/products" },
  { label: "Browse Categories", href: "/categories/living-room" },
];

export function CartPage() {
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.product.price * item.quantity, 0),
    [items]
  );

  const shipping = useMemo(() => {
    if (subtotal <= 0) return 0;
    return subtotal >= 1200 ? 0 : 79;
  }, [subtotal]);

  const tax = useMemo(() => subtotal * 0.1, [subtotal]);
  const discount = useMemo(() => 0, []);
  const grandTotal = subtotal + shipping + tax - discount;

  if (items.length === 0) {
    return (
      <main className="bg-background py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 xl:px-8">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-border bg-white p-8 text-center shadow-sm md:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-3xl font-black text-foreground md:text-4xl">Your cart is empty</h1>
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
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Shopping Cart</p>
            <h1 className="mt-2 text-3xl font-black text-foreground md:text-5xl">Review your items</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Adjust quantities, remove items, and continue to checkout when you're ready.
            </p>
          </div>

          {/* Clear Cart option removed */}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="space-y-4">
            {items.map((item) => (
              <CartItem
                key={`${item.product.id}:${item.product.variantId ?? "default"}`}
                item={item}
                onUpdateQuantity={(quantity) => updateQuantity(item.product.id, quantity, item.product.variantId ?? null)}
                onRemove={() => removeItem(item.product.id, item.product.variantId ?? null)}
              />
            ))}
          </section>

          <CartSummary
            subtotal={subtotal}
            shipping={shipping}
            tax={tax}
            discount={discount}
            total={grandTotal}
            itemCount={items.reduce((total, item) => total + item.quantity, 0)}
          />
        </div>
      </div>
    </main>
  );
}