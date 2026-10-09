"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutError({ reset }: { reset: () => void }) {
  return (
    <main className="container mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Checkout is temporarily unavailable</h1>
      <p className="mt-4 text-muted-foreground" role="alert">
        We couldn’t load your checkout details. Your cart has been kept.
        If you already submitted a payment, check your order before paying again.
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild><Link href="/cart">Back to cart</Link></Button>
      </div>
    </main>
  );
}
