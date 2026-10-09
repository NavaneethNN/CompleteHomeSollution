import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "./actions";

export const metadata: Metadata = { title: "Forgot Password — Complete Home Sollution" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <div className="flex-1 flex items-center justify-center px-5 py-14 bg-secondary/30">
      <div className="w-full max-w-md bg-white rounded-2xl border border-border shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-2">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">Enter your account email. If a password account exists, we’ll send a one-hour reset link.</p>
        {sent && <p className="mb-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">If that account exists, a reset link has been sent.</p>}
        <form action={requestPasswordReset} className="mb-4 space-y-3 text-left">
          <label htmlFor="email" className="text-sm font-semibold">Email address</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="w-full rounded-xl border px-4 py-3" />
          <button className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90">Send reset link</button>
        </form>
        <div className="space-y-3">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3 rounded-xl transition-colors"
          >
            Back to Sign In
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full border border-border text-foreground hover:bg-secondary font-medium text-sm py-3 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Home
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          Need help?{" "}
          <a href="mailto:info@completehomesollution.com.au" className="text-primary hover:underline font-medium">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
