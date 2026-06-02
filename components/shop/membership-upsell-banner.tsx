"use client";

import Link from "next/link";
import { Crown, Sparkles, ArrowRight } from "lucide-react";

interface MembershipUpsellBannerProps {
  savings?: number;
  isCompact?: boolean;
}

export function MembershipUpsellBanner({ 
  savings = 0, 
  isCompact = false 
}: MembershipUpsellBannerProps) {
  if (isCompact) {
    return (
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-xl p-3 border border-primary/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Members save {savings > 0 ? `$${savings.toLocaleString()}` : "more"}
            </span>
          </div>
          <Link 
            href="/account/membership" 
            className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
          >
            Join now →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/10 via-white to-primary/5 rounded-2xl p-5 md:p-6 border border-primary/20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Exclusive Offer
            </span>
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            Join Complete Home Membership
          </h3>
          <p className="text-sm text-muted-foreground">
            Get exclusive discounts, free shipping on all orders, early access to sales, 
            and member-only pricing. {savings > 0 && (
              <span className="text-primary font-semibold">
                Save ${savings.toLocaleString()} on this order alone!
              </span>
            )}
          </p>
        </div>
        <Link
          href="/account/membership"
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors shadow-md whitespace-nowrap"
        >
          <Crown className="h-4 w-4" />
          Become a Member
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
