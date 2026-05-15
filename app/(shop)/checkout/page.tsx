"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export default function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.product.price * item.quantity, 0),
    [items]
  );

  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items]
  );

  // Redirect to cart if empty
  if (items.length === 0) {
    return (
      <main className="bg-background py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 xl:px-8">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-border bg-white p-8 text-center shadow-sm md:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-primary">Checkout</p>
            <h1 className="mt-2 text-3xl font-black text-foreground md:text-4xl">Your cart is empty</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Add items to your cart before proceeding to checkout.
            </p>
            <div className="mt-8">
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary/90"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-6 xl:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Secure Checkout</p>
            <h1 className="mt-2 text-3xl font-black text-foreground md:text-4xl">Complete your order</h1>
          </div>
          <Link
            href="/cart"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Cart
          </Link>
        </div>

        {/* Checkout Form */}
        <CheckoutForm 
          subtotal={subtotal} 
          itemCount={itemCount}
          onCheckoutComplete={clearCart}
        />
      </div>
    </main>
  );
}
