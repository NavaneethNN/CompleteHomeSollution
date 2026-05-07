import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";

export const metadata: Metadata = { title: "My Addresses — Complete Home Sollution" };

export default function AddressesPage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/account/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Addresses</span>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h1 className="font-bold text-lg text-foreground">Saved Addresses</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your delivery addresses</p>
          </div>
          <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <MapPin className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">No saved addresses</p>
            <p className="text-sm text-muted-foreground">Your saved delivery addresses will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
