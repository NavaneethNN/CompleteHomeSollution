import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle, MailX, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { consumeVerificationToken } from "@/lib/token";

export const metadata: Metadata = {
  title: "Verify Email — Complete Home Sollution",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <Result type="invalid" message="No verification token was provided." />;
  }

  const result = await consumeVerificationToken(token);

  if ("error" in result) {
    return <Result type="invalid" message={result.error} />;
  }

  const user = await db.user.findUnique({ where: { email: result.email } });

  if (!user) {
    return <Result type="invalid" message="Account not found. Please register again." />;
  }

  if (user.emailVerified) {
    return <Result type="already" message="Your email is already verified. You can sign in." />;
  }

  await db.user.update({
    where: { email: result.email },
    data: { emailVerified: new Date() },
  });

  return <Result type="success" message={`Welcome, ${user.name?.split(" ")[0] ?? ""}! Your email has been verified.`} />;
}

function Result({
  type,
  message,
}: {
  type: "success" | "invalid" | "already";
  message: string;
}) {
  const config = {
    success: {
      Icon: CheckCircle2,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      title: "Email Verified!",
      cta: { label: "Sign In to Your Account", href: "/login?verified=true" },
    },
    already: {
      Icon: CheckCircle2,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      title: "Already Verified",
      cta: { label: "Go to Sign In", href: "/login" },
    },
    invalid: {
      Icon: type === "invalid" ? XCircle : MailX,
      iconBg: "bg-red-100",
      iconColor: "text-red-500",
      title: "Verification Failed",
      cta: { label: "Back to Register", href: "/register" },
    },
  }[type];

  const { Icon, iconBg, iconColor, title, cta } = config;

  return (
    <div className="flex-1 flex items-center justify-center px-5 py-14 bg-secondary/30">
      <div className="w-full max-w-md bg-white rounded-2xl border border-border shadow-sm p-8 text-center">
        <div className={`w-16 h-16 ${iconBg} rounded-2xl flex items-center justify-center mx-auto mb-5`}>
          <Icon className={`h-8 w-8 ${iconColor}`} />
        </div>

        <h1 className="text-2xl font-black text-foreground mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-7 leading-relaxed">{message}</p>

        <Link
          href={cta.href}
          className="inline-flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3 rounded-xl transition-colors"
        >
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>

        {type !== "success" && (
          <p className="text-xs text-muted-foreground mt-5">
            Need help?{" "}
            <a
              href="mailto:info@completehomesollution.com.au"
              className="text-primary hover:underline font-medium"
            >
              Contact support
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
