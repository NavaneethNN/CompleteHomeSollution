"use client";

import Link from "next/link";
import { ArrowRight, Crown, Sparkles } from "lucide-react";
import { MembershipUpsellBanner } from "./membership-upsell-banner";

interface CartSummaryProps {
  readonly subtotal: number;
  readonly itemCount: number;
  readonly isMember?: boolean;
  readonly memberSavings?: number;
  readonly canCheckout?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export function CartSummary({ subtotal, itemCount, isMember = false, memberSavings = 0, canCheckout = true }: Readonly<CartSummaryProps>) {
  return (
    <aside className="rounded-xl sm:rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-bold text-foreground border-b border-border pb-3 mb-3">Order Summary</h2>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{isMember && memberSavings > 0 ? "Subtotal before member savings" : `Subtotal (${itemCount} ${itemCount === 1 ? "item" : "items"})`}</span>
          <span className="font-semibold text-foreground">{currencyFormatter.format(subtotal + (isMember && memberSavings > 0 ? memberSavings : 0))}</span>
        </div>
        {isMember && memberSavings > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-primary font-medium flex items-center gap-1">
              <Crown className="h-3.5 w-3.5" /> Member savings
            </span>
            <span className="font-semibold text-green-600">-{currencyFormatter.format(memberSavings)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 text-muted-foreground">
          <span>Shipping</span>
          <span className="text-xs">{isMember ? "Free with membership" : "Calculated at checkout"}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-sm font-bold text-foreground">{isMember && memberSavings > 0 ? "Member subtotal" : "Subtotal"}</span>
        <span className="text-lg font-black text-foreground">{currencyFormatter.format(subtotal)}</span>
      </div>

      {/* Membership Upsell for Non-Members */}
      {!isMember && memberSavings > 0 && (
        <div className="mt-4">
          <MembershipUpsellBanner savings={memberSavings} isCompact />
        </div>
      )}

      {canCheckout ? <Link
        href="/checkout"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        Proceed to Checkout
        <ArrowRight className="h-4 w-4" />
      </Link> : <span aria-disabled="true" className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-muted px-6 py-3 text-sm font-bold text-muted-foreground">Checkout unavailable until cart is refreshed</span>}

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {isMember ? "GST included. Shipping is free with membership." : "GST included. Shipping calculated at next step."}
      </p>
    </aside>
  );
}
