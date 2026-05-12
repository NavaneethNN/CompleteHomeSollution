"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CartSummaryProps {
  readonly subtotal: number;
  readonly shipping: number;
  readonly tax: number;
  readonly discount: number;
  readonly total: number;
  readonly itemCount: number;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

function SummaryRow({ label, value, subdued = false }: Readonly<{ label: string; value: number; subdued?: boolean }>) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={cn(subdued ? "text-muted-foreground" : "text-foreground", "font-medium")}>{label}</span>
      <span className={cn("font-semibold", subdued ? "text-muted-foreground" : "text-foreground")}>{currencyFormatter.format(value)}</span>
    </div>
  );
}

export function CartSummary({ subtotal, shipping, tax, discount, total, itemCount }: Readonly<CartSummaryProps>) {
  return (
    <aside className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
      <div className="border-b border-border pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Order Summary</p>
        <h2 className="mt-2 text-2xl font-black text-foreground">Your totals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"} in your cart
        </p>
      </div>

      <div className="space-y-3 py-4">
        <SummaryRow label="Subtotal" value={subtotal} />
        <SummaryRow label="Shipping / Delivery" value={shipping} />
        <SummaryRow label="Tax" value={tax} />
        {discount > 0 ? <SummaryRow label="Discount" value={-discount} subdued /> : null}
      </div>

      <div className="rounded-2xl bg-secondary/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">Grand Total</span>
          <span className="text-2xl font-black text-foreground">{currencyFormatter.format(total)}</span>
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
        Secure checkout and delivery calculated at the next step.
      </p>
    </aside>
  );
}