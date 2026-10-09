import type { Metadata } from "next";
import { Mail } from "lucide-react";

export const metadata: Metadata = { title: "Contact Support — Complete Home Sollution" };

export default function ContactPage() {
  return (
    <main className="container mx-auto max-w-3xl px-5 py-14">
      <h1 className="text-3xl font-black">Contact support</h1>
      <p className="mt-3 text-muted-foreground">For order, delivery, membership, or refund help, include your order number so our team can assist quickly. Never send card details.</p>
      <div className="mt-8 max-w-md">
        <a href="mailto:info@completehomesollution.com.au" className="block rounded-2xl border bg-card p-6 hover:border-primary"><Mail className="h-6 w-6 text-primary" /><h2 className="mt-4 font-bold">Email us</h2><p className="mt-1 text-sm text-muted-foreground break-all">info@completehomesollution.com.au</p></a>
      </div>
    </main>
  );
}
