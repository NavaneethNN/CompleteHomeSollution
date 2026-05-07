import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Forgot Password — Complete Home Sollution" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex-1 flex items-center justify-center px-5 py-14 bg-secondary/30">
      <div className="w-full max-w-md bg-white rounded-2xl border border-border shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-2">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Password reset is coming soon. In the meantime, if you signed up with Google,
          you can continue using Google sign-in. For email/password accounts, please
          contact our support team.
        </p>
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
