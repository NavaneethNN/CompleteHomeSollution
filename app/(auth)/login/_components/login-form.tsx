"use client";

import { useState, useCallback, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  Truck,
  Crown,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Validation ─────────────────────────────────────────────────────── */

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

/* ─── NextAuth error messages ────────────────────────────────────────── */

const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin:
    "Invalid email or password. Please check your details and try again.",
  OAuthAccountNotLinked:
    "This email is already registered with a different sign-in method. Please use the original sign-in method.",
  OAuthCallbackError:   "Google sign-in was cancelled or failed. Please try again.",
  OAuthCallback:        "Google sign-in callback failed. Please try again.",
  OAuthSignin:          "Could not start Google sign-in. Please try again.",
  OAuthCreateAccount:   "Could not create your account via Google. Please try again.",
  Callback:             "An authentication error occurred. Please try again.",
  Configuration:
    "Authentication is not fully configured. Please ensure AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are all set in .env.local, then restart the server.",
  AccessDenied:         "Access was denied. Please try again.",
  Verification:         "The sign-in link has expired. Please request a new one.",
  Default:              "Something went wrong. Please try again.",
};

/* ─── Benefits ───────────────────────────────────────────────────────── */

const BENEFITS = [
  {
    Icon: Crown,
    title: "Exclusive Member Discounts",
    desc: "Up to 30% off your entire order every time",
  },
  {
    Icon: Truck,
    title: "Fast Australia-Wide Delivery",
    desc: "Tracked, reliable shipping to every state",
  },
  {
    Icon: ShieldCheck,
    title: "100% Secure Checkout",
    desc: "Your data is protected and payments are safe",
  },
  {
    Icon: Sparkles,
    title: "Personalised Recommendations",
    desc: "Discover furniture matched to your style",
  },
] as const;

/* ─── Inner component (uses useSearchParams — needs Suspense) ─────────── */

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const errorParam = searchParams.get("error");
  const registered = searchParams.get("registered") === "true";
  const rawCallback = searchParams.get("callbackUrl") ?? "/account/dashboard";
  const callbackUrl =
    rawCallback.startsWith("/") ? rawCallback : "/account/dashboard";

  const [showPw, setShowPw] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(
    errorParam ? (AUTH_ERRORS[errorParam] ?? AUTH_ERRORS.Default) : null
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  /* ── Google OAuth ─────────────────────────────────────────────────── */
  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    setServerError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch (err) {
      console.error("[Google signIn error]", err);
      setServerError(
        "Could not connect to Google. Check your internet connection and try again."
      );
      setGoogleLoading(false);
    }
  }, [callbackUrl]);

  /* ── Email / password sign-in ─────────────────────────────────────── */
  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (!result?.ok) {
      setServerError(
        result?.error
          ? (AUTH_ERRORS[result.error] ?? AUTH_ERRORS.Default)
          : AUTH_ERRORS.Default
      );
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="grid lg:grid-cols-2 flex-1">

      {/* ════════════ LEFT BRAND PANEL (desktop only) ════════════ */}
      <aside className="relative hidden lg:flex flex-col overflow-hidden bg-navy">

        {/* Background image — dining room */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1400&q=80"
            alt="Elegant dining room with premium furniture"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-navy/82" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full px-10 py-12 xl:px-14 xl:py-14">

          {/* Logo */}
          <Link href="/" aria-label="Complete Home Sollution — Home">
            <Image
              src="/chs-logo.png"
              alt="Complete Home Sollution"
              width={180}
              height={55}
              className="h-14 w-auto object-contain brightness-0 invert"
              style={{ width: "auto" }}
            />
          </Link>

          {/* Copy */}
          <div className="space-y-8">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.28em] text-primary uppercase mb-4">
                WELCOME BACK
              </p>
              <h2 className="text-[40px] xl:text-5xl font-black text-white leading-[1.08] mb-2">
                Your Beautiful
              </h2>
              <p className="text-3xl xl:text-[38px] font-script text-primary italic leading-snug">
                Home Awaits
              </p>
              <p className="text-white/65 text-sm leading-relaxed mt-4 max-w-[340px]">
                Sign in to access your orders, track deliveries, manage your
                account and unlock exclusive member pricing on every purchase.
              </p>
            </div>

            {/* Benefits */}
            <ul className="space-y-5">
              {BENEFITS.map(({ Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="mt-0.5 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Icon className="h-[18px] w-[18px] text-primary" />
                  </span>
                  <div>
                    <p className="text-white text-sm font-semibold leading-none mb-1">
                      {title}
                    </p>
                    <p className="text-white/55 text-xs leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom link */}
          <p className="text-white/50 text-sm">
            New to Complete Home Sollution?{" "}
            <Link
              href="/register"
              className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
            >
              Create a free account →
            </Link>
          </p>
        </div>
      </aside>

      {/* ════════════ RIGHT FORM PANEL ════════════ */}
      <section className="flex flex-col justify-center px-5 py-10 sm:px-8 md:px-12 xl:px-16 bg-white overflow-y-auto">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex justify-center">
          <Link href="/" aria-label="Complete Home Sollution — Home">
            <Image
              src="/chs-logo.png"
              alt="Complete Home Sollution"
              width={160}
              height={49}
              className="h-12 w-auto object-contain"
              style={{ width: "auto" }}
            />
          </Link>
        </div>

        <div className="w-full max-w-[440px] mx-auto">

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-[28px] font-black text-foreground leading-tight mb-1.5">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
              >
                Create one free
              </Link>
            </p>
          </div>

          {/* ── Registered success banner ────────────────────────── */}
          {registered && (
            <div className="mb-5 flex items-start gap-2.5 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Account created successfully! Sign in to get started.
              </span>
            </div>
          )}

          {/* ── Google OAuth button ──────────────────────────────── */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || isSubmitting}
            aria-label="Continue with Google"
            className="w-full flex items-center justify-center gap-3 h-12 border-2 border-border bg-white hover:bg-secondary/70 text-foreground font-semibold text-sm rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mb-5 shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>
              {googleLoading ? "Connecting to Google…" : "Continue with Google"}
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase select-none">
              or sign in with email
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Server-level error */}
          {serverError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 px-4 py-3 bg-destructive/8 border border-destructive/25 rounded-xl text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* ── Sign-in form ─────────────────────────────────────── */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            aria-label="Sign in form"
            className="space-y-4"
          >
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-sm font-semibold text-foreground"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="john@example.com.au"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "le-error" : undefined}
                  {...register("email")}
                  className={cn(
                    "w-full h-12 rounded-xl border bg-white pl-10 pr-4 text-sm outline-none transition-all duration-200",
                    "placeholder:text-muted-foreground",
                    "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    errors.email
                      ? "border-destructive focus:ring-destructive/20"
                      : "border-border hover:border-primary/40"
                  )}
                />
              </div>
              {errors.email && (
                <p
                  id="le-error"
                  role="alert"
                  className="flex items-center gap-1.5 text-xs text-destructive mt-1.5"
                >
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-semibold text-foreground"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary font-medium hover:underline shrink-0 focus-visible:outline-none"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="login-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "lp-error" : undefined}
                  {...register("password")}
                  className={cn(
                    "w-full h-12 rounded-xl border bg-white pl-10 pr-11 text-sm outline-none transition-all duration-200",
                    "placeholder:text-muted-foreground",
                    "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    errors.password
                      ? "border-destructive focus:ring-destructive/20"
                      : "border-border hover:border-primary/40"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p
                  id="lp-error"
                  role="alert"
                  className="flex items-center gap-1.5 text-xs text-destructive mt-1.5"
                >
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || googleLoading}
              className="w-full h-12 bg-primary hover:bg-primary/90 active:scale-[0.99] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-1 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing In…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Create account link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            New to Complete Home Sollution?{" "}
            <Link
              href="/register"
              className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
            >
              Create a free account
            </Link>
          </p>

          {/* ── Trust strip ──────────────────────────────────────── */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-start justify-around gap-4">
              {(
                [
                  { Icon: ShieldCheck, label: "Secure &\nEncrypted" },
                  { Icon: Crown,       label: "Members Save\nUp to 30%" },
                  { Icon: Truck,       label: "AU-Wide\nDelivery" },
                ] as const
              ).map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1.5 text-center min-w-0"
                >
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground leading-tight whitespace-pre-line">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}

/* ─── Exported wrapper with Suspense for useSearchParams ─────────────── */

export default function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
