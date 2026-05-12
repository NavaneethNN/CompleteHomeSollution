import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <main className="bg-background py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6 xl:px-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-border bg-white p-8 shadow-sm md:p-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-primary">Checkout</p>
          <h1 className="mt-2 text-3xl font-black text-foreground md:text-4xl">Placeholder checkout page</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            This page is ready for payment, shipping, and order confirmation wiring. For now, it serves as a clean handoff from the cart flow.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/cart"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-foreground px-6 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-foreground hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Cart
            </Link>
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
