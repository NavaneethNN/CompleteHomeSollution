"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OrderConfirmationError({ reset }: { reset: () => void }) {
  return (
    <main className="container mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">We couldn&apos;t load this order yet</h1>
      <p className="mt-4 text-muted-foreground" role="alert">
        Your payment may still be settling. Please do not place the same order again while we check the bank response.
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/account/orders">View orders</Link>
        </Button>
      </div>
    </main>
  );
}
