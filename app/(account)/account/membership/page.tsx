import type { Metadata } from "next";
import Link from "next/link";
import { Crown, ChevronRight, Star, Truck, ShieldCheck, Tag } from "lucide-react";

export const metadata: Metadata = { title: "Membership — Complete Home Sollution" };

const PERKS = [
  { Icon: Tag,         text: "Up to 30% off every order" },
  { Icon: Truck,       text: "Free express delivery on orders over $200" },
  { Icon: ShieldCheck, text: "Extended 3-year warranty on all products" },
  { Icon: Star,        text: "Priority customer support 7 days a week" },
] as const;

export default function MembershipPage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/account/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Membership</span>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div
            className="px-6 py-10 text-white text-center"
            style={{ backgroundColor: "var(--navy)" }}
          >
            <Crown className="h-10 w-10 text-amber-400 mx-auto mb-3" />
            <h1 className="text-2xl font-black mb-2">Complete Home Sollution Membership</h1>
            <p className="text-white/60 text-sm max-w-md mx-auto">
              Join our exclusive membership program and save big on every order.
            </p>
          </div>
          <div className="p-8">
            <h2 className="font-bold text-foreground text-center mb-6">Member Benefits</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {PERKS.map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 border border-border">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{text}</span>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">Membership plans coming soon. Contact us to learn more.</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                Back to Shop
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
