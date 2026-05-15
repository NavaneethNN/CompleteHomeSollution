import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { auth } from "@/auth";
import { getAddresses } from "@/lib/actions/address";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { CartSummary } from "@/components/shop/cart-summary";

export const metadata: Metadata = { title: "Checkout — Complete Home Sollution" };

export default async function CheckoutPage() {
  const session = await auth();
  const { addresses, error } = await getAddresses();

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

        {/* Checkout Form - Client Component with Address Management */}
        <CheckoutForm 
          savedAddresses={addresses || []}
          addressesError={error}
          isAuthenticated={!!session}
        />
      </div>
    </main>
  );
}
