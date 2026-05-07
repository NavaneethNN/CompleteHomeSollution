import type { Metadata } from "next";
import Link from "next/link";
import { Package, ChevronRight, ShoppingBag } from "lucide-react";

export const metadata: Metadata = { title: "My Orders — Complete Home Sollution" };

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/account/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">My Orders</span>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h1 className="font-bold text-lg text-foreground">My Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track and manage your purchases</p>
          </div>
          <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Package className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">No orders yet</p>
            <p className="text-sm text-muted-foreground mb-5">Your order history will appear here.</p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
            >
              <ShoppingBag className="h-4 w-4" /> Start Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
