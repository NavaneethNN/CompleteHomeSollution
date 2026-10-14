"use client";

export default function ShopError({ reset }: { reset: () => void }) {
  return (
    <main className="container mx-auto px-5 py-16 text-center">
      <h1 className="text-2xl font-bold">We couldn’t load this page</h1>
      <p className="mt-3 text-muted-foreground">The shop is temporarily unavailable. Please try again shortly.</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">
        Try again
      </button>
    </main>
  );
}
