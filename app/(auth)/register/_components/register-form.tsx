"use client";

import { useState, useCallback, useEffect } from "react";
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
  User,
  ArrowRight,
  CheckCircle2,
  Truck,
  Award,
  ShieldCheck,
  Crown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { registerUser } from "../actions";
import { cn } from "@/lib/utils";
import { getSafeCallbackUrl } from "@/lib/safe-callback";

/* ─── Validation schema ─────────────────────────────────────────────── */

const schema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name must be 60 characters or less"),
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be 72 characters or less"),
    confirmPassword: z.string(),
    terms: z.boolean().refine((v) => v === true, {
      message: "You must accept the terms to continue",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

/* ─── Password strength ─────────────────────────────────────────────── */

interface StrengthResult {
  score: number;
  label: string;
  barColor: string;
  textColor: string;
}

function getPasswordStrength(pw: string): StrengthResult {
  if (!pw) return { score: 0, label: "", barColor: "", textColor: "" };

  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels: StrengthResult[] = [
    { score: 0, label: "", barColor: "", textColor: "" },
    { score: 1, label: "Weak",        barColor: "bg-red-500",     textColor: "text-red-500" },
    { score: 2, label: "Fair",        barColor: "bg-orange-500",  textColor: "text-orange-500" },
    { score: 3, label: "Good",        barColor: "bg-yellow-500",  textColor: "text-yellow-600" },
    { score: 4, label: "Strong",      barColor: "bg-green-500",   textColor: "text-green-600" },
    { score: 5, label: "Very Strong", barColor: "bg-emerald-600", textColor: "text-emerald-600" },
  ];

  return levels[score] ?? levels[1];
}

/* ─── Benefits list ─────────────────────────────────────────────────── */

const BENEFITS = [
  {
    Icon: Crown,
    title: "Member-Exclusive Pricing",
    desc: "Save up to 30% on every order as a member",
  },
  {
    Icon: Truck,
    title: "Free Australia-Wide Delivery",
    desc: "On qualifying orders shipped anywhere in AU",
  },
  {
    Icon: Award,
    title: "Priority Customer Support",
    desc: "24/7 dedicated support whenever you need it",
  },
  {
    Icon: ShieldCheck,
    title: "Secure & Safe Shopping",
    desc: "100% encrypted, fraud-protected transactions",
  },
] as const;

/* ─── Reusable field wrapper ─────────────────────────────────────────── */

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive mt-1.5">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));
  
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { terms: false },
  });

  const password = watch("password", "");
  const strength = getPasswordStrength(password);

  // Reset google loading if there's an error (user cancelled OAuth)
  const errorParam = searchParams.get("error");
  useEffect(() => {
    if (errorParam) {
      setGoogleLoading(false);
    }
  }, [errorParam]);

  // Timeout to reset loading if OAuth hangs
  useEffect(() => {
    if (googleLoading) {
      const timer = setTimeout(() => {
        setGoogleLoading(false);
      }, 10000); // 10 second timeout
      return () => clearTimeout(timer);
    }
  }, [googleLoading]);

  // Auto-dismiss error messages after 5 seconds
  useEffect(() => {
    if (serverError) {
      const timer = setTimeout(() => {
        setServerError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [serverError]);

  /* ── Google OAuth ─────────────────────────────────────────────────── */
  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    setServerError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch (err) {
      console.error("[Google signIn error]", err);
      setServerError(
        "Google sign-in was cancelled or failed. Please try again."
      );
      setGoogleLoading(false);
    }
  }, [callbackUrl]);

  /* ── Email/password registration ──────────────────────────────────── */
  const onSubmit = async (data: FormData) => {
    setServerError(null);

    const result = await registerUser({
      name: data.name,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
    });

    if (result.error) {
      const field = result.field as keyof FormData | undefined;
      if (field && field in data) {
        setError(field, { message: result.error });
      } else {
        setServerError(result.error);
      }
      return;
    }

    if (result.success) {
      setSuccess(true);
    }
  };

  /* ── Success screen ───────────────────────────────────────────────── */
  if (success) {
    return (
      <div className="flex items-center justify-center py-24 px-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">Check your inbox!</h2>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            We&apos;ve sent a verification link to your email address.
          </p>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Click the link in the email to activate your account, then sign in.
          </p>
          <p className="text-xs text-muted-foreground">
            Didn&apos;t receive it? Check your spam folder or{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">try again</Link>.
          </p>
        </div>
      </div>
    );
  }

  /* ── Main render ──────────────────────────────────────────────────── */
  return (
    <div className="grid lg:grid-cols-2 flex-1">

      {/* ════════════ LEFT BRAND PANEL (desktop only) ════════════ */}
      <aside className="relative hidden lg:flex flex-col overflow-hidden bg-navy">

        {/* Background furniture image */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1400&q=80"
            alt="Modern living room with premium furniture"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-navy/82" />
        </div>

        {/* Content column */}
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

          {/* Middle copy */}
          <div className="space-y-8">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.28em] text-primary uppercase mb-4">
                JOIN US TODAY
              </p>
              <h2 className="text-[40px] xl:text-5xl font-black text-white leading-[1.08] mb-2">
                Premium Furniture
              </h2>
              <p className="text-3xl xl:text-[38px] font-script text-primary italic leading-snug">
                Delivered to Your Door
              </p>
              <p className="text-white/65 text-sm leading-relaxed mt-4 max-w-[340px]">
                Join thousands of Australians who trust Complete Home Sollution for quality furniture, fast nationwide delivery, and exclusive member-only pricing.
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

          {/* Bottom sign-in prompt */}
          <p className="text-white/50 text-sm">
            Already a member?{" "}
            <Link
              href={`/login${callbackUrl !== "/account/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
            >
              Sign in here →
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
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href={`/login${callbackUrl !== "/account/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
                className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
              >
                Sign in
              </Link>
            </p>
          </div>

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
              or create with email
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Server-level error banner */}
          {serverError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 px-4 py-3 bg-destructive/8 border border-destructive/25 rounded-xl text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* ── Registration form ────────────────────────────────── */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            aria-label="Create account form"
            className="space-y-4"
          >
            {/* Full Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg-name"
                className="block text-sm font-semibold text-foreground"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Smith"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  {...register("name")}
                  className={cn(
                    "w-full h-12 rounded-xl border bg-white pl-10 pr-4 text-sm outline-none transition-all duration-200",
                    "placeholder:text-muted-foreground",
                    "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    errors.name
                      ? "border-destructive focus:ring-destructive/20"
                      : "border-border hover:border-primary/40"
                  )}
                />
              </div>
              <div id="name-error">
                <FieldError message={errors.name?.message} />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg-email"
                className="block text-sm font-semibold text-foreground"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="john@example.com.au"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
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
              <div id="email-error">
                <FieldError message={errors.email?.message} />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg-password"
                className="block text-sm font-semibold text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="reg-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  aria-invalid={!!errors.password}
                  aria-describedby="pw-strength pw-error"
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

              {/* Strength meter */}
              {password.length > 0 && (
                <div id="pw-strength" className="pt-1 space-y-1.5">
                  <div className="flex gap-1" role="presentation">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-all duration-300",
                          i <= strength.score ? strength.barColor : "bg-border"
                        )}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <p className="text-[11px] text-muted-foreground">
                      Strength:{" "}
                      <span className={cn("font-semibold", strength.textColor)}>
                        {strength.label}
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div id="pw-error">
                <FieldError message={errors.password?.message} />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg-confirm"
                className="block text-sm font-semibold text-foreground"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="reg-confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
                  {...register("confirmPassword")}
                  className={cn(
                    "w-full h-12 rounded-xl border bg-white pl-10 pr-11 text-sm outline-none transition-all duration-200",
                    "placeholder:text-muted-foreground",
                    "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    errors.confirmPassword
                      ? "border-destructive focus:ring-destructive/20"
                      : "border-border hover:border-primary/40"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div id="confirm-error">
                <FieldError message={errors.confirmPassword?.message} />
              </div>
            </div>

            {/* Terms & Privacy */}
            <div className="pt-1 space-y-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  aria-describedby={errors.terms ? "terms-error" : undefined}
                  {...register("terms")}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary shrink-0 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                  I agree to Complete Home Sollution&apos;s{" "}
                  <Link
                    href="/terms"
                    className="text-primary font-semibold hover:underline focus-visible:outline-none"
                    tabIndex={-1}
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-primary font-semibold hover:underline focus-visible:outline-none"
                    tabIndex={-1}
                  >
                    Privacy Policy
                  </Link>
                  . Members save up to{" "}
                  <strong className="text-foreground font-bold">30%</strong> on
                  every order.
                </span>
              </label>
              <div id="terms-error" className="pl-7">
                <FieldError message={errors.terms?.message} />
              </div>
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
                  Creating Account…
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Sign-in link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already a member?{" "}
            <Link
              href={`/login${callbackUrl !== "/account/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
            >
              Sign in to your account
            </Link>
          </p>

          {/* ── Trust strip ──────────────────────────────────────── */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-start justify-around gap-4">
              {(
                [
                  { Icon: ShieldCheck, label: "Secure &\nEncrypted" },
                  { Icon: Award,       label: "Trusted by\nAussies" },
                  { Icon: Truck,       label: "AU-Wide\nDelivery" },
                ] as const
              ).map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 text-center min-w-0">
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
