"use client";

import Link from "next/link";
import { ArrowRight, Crown } from "lucide-react";

interface CartSummaryProps {
  readonly subtotal: number;
  readonly itemCount: number;
  readonly isMember?: boolean;
  readonly memberSavings?: number;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export function CartSummary({ subtotal, itemCount, isMember = false, memberSavings = 0 }: Readonly<CartSummaryProps>) {
  return (
    <aside className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
      <div className="border-b border-border pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Order Summary</p>
        <h2 className="mt-2 text-2xl font-black text-foreground">Your totals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"} in your cart
        </p>
      </div>

      <div className="py-4 space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-foreground">Subtotal</span>
          <span className="font-semibold text-foreground">{currencyFormatter.format(subtotal)}</span>
        </div>
        {isMember && memberSavings > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-primary font-medium flex items-center gap-1">
              <Crown className="h-3.5 w-3.5" /> Member savings
            </span>
            <span className="font-semibold text-green-600">-{currencyFormatter.format(memberSavings)}</span>
          </div>
        )}
        {isMember && (
          <p className="text-xs text-green-600 font-medium flex items-center gap-1">
            <Crown className="h-3 w-3" /> Free shipping on your order
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {isMember ? "GST calculated at checkout." : "Shipping and GST calculated at checkout."}
        </p>
      </div>

      <div className="rounded-2xl bg-secondary/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">Subtotal</span>
          <span className="text-2xl font-black text-foreground">{currencyFormatter.format(subtotal)}</span>
        </div>
      </div>

      <Link
        href="/checkout"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary/90"
      >
        Proceed to Checkout
        <ArrowRight className="h-4 w-4" />
      </Link>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Secure checkout — shipping &amp; GST calculated at the next step.
      </p>
    </aside>
  );
}