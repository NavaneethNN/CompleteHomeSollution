import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getActiveMembershipPlan, durationLabel } from "@/lib/membership-plan";
import { enforceExpiry, hasActiveMembership } from "@/lib/membership";
import { MembershipAutopayControls } from "@/components/account/membership-autopay-controls";
import { MembershipSavingsCalculator } from "@/components/account/membership-savings-calculator";
import { MembershipFaq } from "@/components/account/membership-faq";
import {
  Crown,
  CheckCircle2,
  ShieldCheck,
  Tag,
  Zap,
  CalendarDays,
  ChevronRight,
  ArrowRight,
  Sparkles,
  AlertCircle,
  XCircle,
  Package,
  Truck,
  PhoneCall,
  Star,
  Lock,
  Check,
  ShoppingBag,
} from "lucide-react";

export const metadata: Metadata = {
  title: "CHS VIP Membership — Save 5% on Every Furniture Order",
  description:
    "Join Complete Home Solution VIP. Save up to $30 on every furniture order, get exclusive member pricing, 3-year extended warranty, and priority dispatch across Australia.",
  robots: { index: true, follow: true },
};

const currencyFmt = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
});

const VIP_PERKS = [
  {
    Icon: Tag,
    title: "Instant 5% Off Every Order",
    desc: "Save up to $30 automatically on every single checkout. No promo codes needed — automatically applied.",
    badge: "Every Order",
  },
  {
    Icon: Sparkles,
    title: "Member-Only Catalog Pricing",
    desc: "Unlock promotional pricing on selected timber bed frames, luxury sofas, and dining suites.",
    badge: "Exclusive",
  },
  {
    Icon: ShieldCheck,
    title: "3-Year Extended Warranty",
    desc: "Double our standard 1-year coverage on all timber frames, joints, springs, and upholstery for total peace of mind.",
    badge: "$99 Value",
  },
  {
    Icon: Truck,
    title: "Priority Warehouse Dispatch",
    desc: "VIP orders jump to the front of the queue for express packing and courier pickup across Australia.",
    badge: "Priority Queue",
  },
  {
    Icon: Zap,
    title: "48-Hour Early Sale Access",
    desc: "Shop major seasonal events (EOFY, Black Friday, Boxing Day) 2 days before the general public.",
    badge: "First Dibs",
  },
  {
    Icon: PhoneCall,
    title: "Dedicated VIP Concierge",
    desc: "Direct telephone and priority email support with our Adelaide styling and logistics specialists.",
    badge: "Direct Line",
  },
];

const COMPARISON_ROWS = [
  { feature: "Everyday Furniture Discount", guest: "Retail price (0%)", vip: "5% Off (up to $30 / order)" },
  { feature: "Exclusive Member Pricing", guest: "Standard prices only", vip: "Unlocked on curated items" },
  { feature: "Structural Warranty", guest: "1-Year standard", vip: "3-Year Extended Warranty" },
  { feature: "Warehouse Handling", guest: "Standard dispatch (5–7 days)", vip: "Priority express queue" },
  { feature: "Sale Event Access", guest: "Public launch", vip: "48 Hours early access" },
  { feature: "Customer Support", guest: "Standard email", vip: "Priority phone & direct line" },
];

const TESTIMONIALS = [
  {
    quote: "Saved $30 on our velvet sofa instantly at checkout. The membership paid for itself before the sofa even left the warehouse!",
    name: "Sarah M.",
    location: "Adelaide, SA",
    saving: "Saved $30 on Order #1",
  },
  {
    quote: "The 3-year warranty gave us complete peace of mind for our new timber dining table and 6 chairs. Essential value for money.",
    name: "David & Kelly K.",
    location: "Melbourne, VIC",
    saving: "Saved $30 + 3-Yr Warranty",
  },
  {
    quote: "Early access allowed us to get the exact oak king bed we wanted before it sold out. Best $20 investment in our home this year.",
    name: "Marcus L.",
    location: "Sydney, NSW",
    saving: "VIP Early Access",
  },
];

export default async function MembershipPage() {
  const session = await auth();
  const user = session?.user;

  if (user?.id) {
    await enforceExpiry(user.id);
  }

  // Always read from DB when user is logged in
  const [dbUser, activePlan] = await Promise.all([
    user?.id
      ? db.user.findUnique({
          where: { id: user.id },
          select: {
            isMember: true,
            memberSince: true,
            membershipExpiry: true,
            membershipAutoRenew: true,
            membershipStatus: true,
            membershipCancelReason: true,
            membershipCancelledAt: true,
            membershipRetryCount: true,
            membershipNextRetryAt: true,
            name: true,
            email: true,
          },
        })
      : null,
    getActiveMembershipPlan(),
  ]);

  const isMember = hasActiveMembership(dbUser);
  const memberSince = dbUser?.memberSince;
  const expiredAt =
    dbUser?.membershipExpiry && dbUser.membershipExpiry <= new Date()
      ? dbUser.membershipExpiry
      : null;

  const planPrice = activePlan?.price ?? 20;
  const planDuration = activePlan ? durationLabel(activePlan.durationDays) : "year";
  const checkoutUrl = activePlan ? `/membership/checkout?planId=${activePlan.id}` : undefined;

  const isCancelled = dbUser?.membershipStatus === "CANCELLED";
  const isPaymentFailed = dbUser?.membershipStatus === "REVOKED_PAYMENT_FAILURE";

  return (
    <div className="min-h-screen bg-white">
      {/* ── Sub-header / Breadcrumbs ── */}
      <div className="border-b border-border bg-[#fdfbf9]">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            {user ? (
              <Link href="/account/dashboard" className="hover:text-primary transition-colors">
                Account
              </Link>
            ) : (
              <span>Shop</span>
            )}
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold">VIP Membership</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Australian Owned
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Satisfaction Guarantee
            </span>
          </div>
        </div>
      </div>

      {/* ── Status alerts for past cancellations / revocations ── */}
      {(isPaymentFailed || isCancelled) && !isMember && (
        <div className="container mx-auto px-4 sm:px-6 pt-6">
          {isPaymentFailed && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5 text-sm text-red-900 flex items-start gap-3 shadow-xs">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-950">
                  Membership Revoked: Payment Renewal Failed
                </p>
                <p className="text-red-800 text-xs">
                  Your CHS membership was revoked because automatic renewal payments failed after 2 retry attempts. Autopay was cancelled.
                </p>
                <p className="text-red-700 text-xs font-semibold pt-1">
                  You can re-subscribe anytime with an updated payment card below.
                </p>
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="rounded-2xl border border-border bg-secondary/50 p-4 sm:p-5 text-sm text-foreground flex items-start gap-3 shadow-xs">
              <XCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-foreground">Membership Cancelled</p>
                <p className="text-muted-foreground text-xs">
                  Your VIP membership was cancelled manually. Recurring autopay was cancelled and member benefits were stopped.
                </p>
                <p className="text-foreground text-xs font-medium pt-0.5">
                  Ready to return? You can activate a new membership below anytime.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ACTIVE MEMBER VIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {isMember ? (
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 max-w-5xl">
          {/* VIP Member Pass Banner (Site Theme) */}
          <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#1a2233] to-[#0f1422] text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-md font-bold">
                  <Crown className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> ACTIVE VIP MEMBER
                    </span>
                    {dbUser?.membershipAutoRenew && (
                      <span className="inline-flex items-center gap-1 bg-white/10 text-white/90 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                        AUTOPAY ON
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-white flex items-center gap-2">
                    {dbUser?.name ? `${dbUser.name}'s VIP Membership` : "Complete Home VIP Member"}
                    <Sparkles className="h-4 w-4 text-amber-300" />
                  </h1>

                  <p className="text-white/70 text-xs sm:text-sm mt-1">
                    {memberSince
                      ? `Member since ${new Date(memberSince).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}`
                      : "Your membership is active and enjoying full privileges"}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                <Link
                  href="/products"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 text-center shadow-xs"
                >
                  <ShoppingBag className="h-4 w-4" /> Shop Member Prices
                </Link>
                <Link
                  href="/account/orders"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/10 hover:bg-white/15 px-6 text-sm font-semibold text-white border border-white/20 transition-colors text-center"
                >
                  <Package className="h-4 w-4" /> View My Orders
                </Link>
              </div>
            </div>

            {/* Quick stats footer */}
            <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-white/60 block">Everyday Savings</span>
                <span className="font-bold text-emerald-400 text-sm">5% Off (up to $30)</span>
              </div>
              <div>
                <span className="text-white/60 block">Warranty Status</span>
                <span className="font-bold text-amber-300 text-sm">3-Year Extended</span>
              </div>
              <div>
                <span className="text-white/60 block">Dispatch Status</span>
                <span className="font-bold text-white text-sm">Priority Queue</span>
              </div>
              <div>
                <span className="text-white/60 block">Current Plan</span>
                <span className="font-bold text-white text-sm">
                  {currencyFmt.format(planPrice)} / {planDuration}
                </span>
              </div>
            </div>
          </div>

          {/* Valid until indicator */}
          {memberSince && (
            <div className="bg-secondary/40 rounded-2xl border border-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-border text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Membership Valid Until</p>
                  <p className="text-sm sm:text-base font-bold text-foreground">
                    {dbUser?.membershipExpiry
                      ? new Date(dbUser.membershipExpiry).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "Active"}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full self-start sm:self-center">
                ✓ All Perks Active
              </span>
            </div>
          )}

          {/* Autopay Controls */}
          <MembershipAutopayControls
            isMember={isMember}
            initialAutoRenew={dbUser?.membershipAutoRenew ?? true}
            membershipExpiry={dbUser?.membershipExpiry ? dbUser.membershipExpiry.toISOString() : null}
            membershipStatus={dbUser?.membershipStatus ?? null}
            membershipCancelReason={dbUser?.membershipCancelReason ?? null}
            retryCount={dbUser?.membershipRetryCount ?? 0}
            nextRetryAt={dbUser?.membershipNextRetryAt ? dbUser.membershipNextRetryAt.toISOString() : null}
            isAdmin={user?.role === "ADMIN"}
          />

          {/* Member perks grid */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-border p-6 sm:p-8 shadow-xs">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                Your Member Privileges
                <Sparkles className="h-4 w-4 text-primary" />
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Automatically applied to your account across completehomesollution.com.au
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {VIP_PERKS.map(({ Icon, title, desc, badge }) => (
                <div
                  key={title}
                  className="p-4 sm:p-5 rounded-xl bg-secondary/30 border border-border flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        {badge}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Active on your account
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calculator */}
          <MembershipSavingsCalculator
            planPrice={planPrice}
            planDuration={planDuration}
            isMember={true}
          />
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════════════
            NON-MEMBER / CONVERSION VIEW (MOBILE-FIRST SITE THEME)
        ════════════════════════════════════════════════════════════════════════ */
        <div>
          {/* ── 1. Hero Section (Light, Warm, Full-Bleed) ── */}
          <section className="bg-[#f7f3ed] py-8 sm:py-14 md:py-20 border-b border-border">
            <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
              <div className="max-w-2xl">
                {/* Crown VIP pill */}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3.5 py-1 text-xs font-bold uppercase tracking-wider mb-4 border border-primary/20">
                  <Crown className="h-3.5 w-3.5" />
                  <span>COMPLETE HOME SOLUTION VIP</span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.12] mb-4">
                  {expiredAt ? (
                    <>Your VIP access has expired. Renew to continue saving.</>
                  ) : (
                    <>
                      Furnish your home for less. <br />
                      <span className="text-primary font-normal italic font-script text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
                        Save 5% on every piece.
                      </span>
                    </>
                  )}
                </h1>

                <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed mb-6">
                  {expiredAt
                    ? `Your benefits ended on ${new Date(expiredAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}. Renew today to restore your 5% discount, 3-year warranty, and priority dispatch.`
                    : "Join Complete Home Solution VIP. Enjoy instant 5% savings (up to $30 per order), exclusive member prices, a 3-Year Extended Warranty, and priority dispatch."}
                </p>

                {/* Quick benefit pills on mobile */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 py-4 border-y border-border/80 text-xs text-foreground font-medium mb-6">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary shrink-0" />
                    <span>5% off every order</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <span>3-Year warranty</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary shrink-0" />
                    <span>Priority dispatch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary shrink-0" />
                    <span>Cancel anytime</span>
                  </div>
                </div>

                {/* Main Hero CTA */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {checkoutUrl ? (
                    <Link
                      href={checkoutUrl}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary/90 transition-all text-center"
                    >
                      <Crown className="h-4 w-4" />
                      {expiredAt
                        ? "Renew VIP Membership"
                        : `Become a Member — ${currencyFmt.format(planPrice)}/${planDuration}`}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <p className="text-muted-foreground text-sm">Plans temporarily unavailable.</p>
                  )}

                  <span className="text-xs text-muted-foreground text-center sm:text-left">
                    Just ~${(planPrice / 365).toFixed(2)}/day • Instant activation at checkout
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Admin diagnostic simulator */}
          {user?.role === "ADMIN" && (
            <div className="container mx-auto px-4 sm:px-6 pt-6">
              <div className="bg-white rounded-2xl border border-amber-300 p-5 shadow-xs">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-3">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  Admin Autopay Diagnostics & Simulator
                </div>
                <MembershipAutopayControls
                  isMember={false}
                  initialAutoRenew={dbUser?.membershipAutoRenew ?? true}
                  membershipExpiry={null}
                  membershipStatus={dbUser?.membershipStatus ?? null}
                  membershipCancelReason={dbUser?.membershipCancelReason ?? null}
                  retryCount={dbUser?.membershipRetryCount ?? 0}
                  nextRetryAt={null}
                  isAdmin={true}
                />
              </div>
            </div>
          )}

          {/* ── 2. The Simple Math: "Pays For Itself on Order #1" ── */}
          <section className="py-10 sm:py-16 md:py-20 bg-white">
            <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
              <div className="max-w-xl mb-8 sm:mb-12">
                <span className="inline-block text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2">
                  The Simple Math
                </span>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-tight">
                  Pays for itself on your very first purchase.
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
                  You don&apos;t have to redecorate your whole home to benefit. Here is how our members save on real furniture pieces:
                </p>
              </div>

              {/* 3 Real-Life Examples (Mobile-first clean cards) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {/* Example 1 */}
                <div className="bg-secondary/30 rounded-2xl p-5 sm:p-6 border border-border flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span className="font-semibold uppercase tracking-wider text-[10px]">Bedroom</span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        100% Covered
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground text-base mb-1">
                      Queen Timber Bed Frame
                    </h3>
                    <p className="text-xs text-muted-foreground">Standard spend: $600.00</p>

                    <div className="my-4 py-3 border-y border-border/80 space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Standard price:</span>
                        <span className="line-through">$600.00</span>
                      </div>
                      <div className="flex justify-between text-primary font-bold">
                        <span>5% VIP discount:</span>
                        <span>-$30.00</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground text-sm pt-1">
                        <span>VIP price:</span>
                        <span>$570.00</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl text-center border border-emerald-200/60">
                    ✓ $30 saved: 100% pays for membership!
                  </p>
                </div>

                {/* Example 2 (Featured) */}
                <div className="bg-gradient-to-br from-primary/5 via-white to-secondary/40 rounded-2xl p-5 sm:p-6 border-2 border-primary/30 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span className="font-semibold uppercase tracking-wider text-[10px] text-primary">Living Room</span>
                      <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                        Best Value
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground text-base mb-1">
                      Sectional Corner Lounge
                    </h3>
                    <p className="text-xs text-muted-foreground">Standard spend: $1,400.00</p>

                    <div className="my-4 py-3 border-y border-primary/15 space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Standard price:</span>
                        <span className="line-through">$1,400.00</span>
                      </div>
                      <div className="flex justify-between text-primary font-bold">
                        <span>5% VIP discount (max cap):</span>
                        <span>-$30.00</span>
                      </div>
                      <div className="flex justify-between text-amber-700 font-medium">
                        <span>3-Year Extended Warranty:</span>
                        <span>FREE ($99 val)</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground text-sm pt-1">
                        <span>VIP price:</span>
                        <span>$1,370.00</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-primary bg-primary/10 p-2.5 rounded-xl text-center">
                    💎 $129+ total value gained on day one
                  </p>
                </div>

                {/* Example 3 */}
                <div className="bg-secondary/30 rounded-2xl p-5 sm:p-6 border border-border flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span className="font-semibold uppercase tracking-wider text-[10px]">Dining & Decor</span>
                      <span className="text-foreground font-bold bg-secondary px-2 py-0.5 rounded-full border border-border">
                        Continuous
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground text-base mb-1">
                      Dining Set & Homewares
                    </h3>
                    <p className="text-xs text-muted-foreground">3 smaller orders over the year ($850)</p>

                    <div className="my-4 py-3 border-y border-border/80 space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Combined standard:</span>
                        <span className="line-through">$850.00</span>
                      </div>
                      <div className="flex justify-between text-primary font-bold">
                        <span>Cumulative VIP savings:</span>
                        <span>-$42.50</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground text-sm pt-1">
                        <span>Total paid:</span>
                        <span>$807.50</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-foreground bg-white p-2.5 rounded-xl text-center border border-border">
                    ⭐ Uncapped savings on every checkout
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 3. Interactive Savings Calculator (Light Theme) ── */}
          <section className="py-10 sm:py-16 bg-[#f7f3ed] border-y border-border">
            <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
              <MembershipSavingsCalculator
                planPrice={planPrice}
                planDuration={planDuration}
                checkoutUrl={checkoutUrl}
                isMember={false}
              />
            </div>
          </section>

          {/* ── 4. The 6 VIP Privileges ── */}
          <section className="py-12 sm:py-18 md:py-24 bg-white">
            <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
              <div className="max-w-xl mb-8 sm:mb-12">
                <span className="inline-block text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2">
                  Membership Benefits
                </span>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-tight">
                  Everything included in your annual pass.
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
                  Tailored for Australian homeowners who value durability, design, and clear savings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {VIP_PERKS.map(({ Icon, title, desc, badge }) => (
                  <div
                    key={title}
                    className="p-5 sm:p-6 rounded-2xl bg-secondary/30 border border-border hover:border-primary/40 hover:bg-secondary/50 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold text-primary bg-white border border-primary/20 px-2.5 py-0.5 rounded-full">
                          {badge}
                        </span>
                      </div>

                      <h3 className="font-semibold text-foreground text-base mb-1.5">{title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {desc}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-border/60 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <Check className="h-3.5 w-3.5" />
                      Included in VIP pass
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 5. Comparison: Guest vs VIP Member ── */}
          <section className="py-10 sm:py-16 bg-[#f7f3ed] border-y border-border">
            <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
              <div className="max-w-xl mb-8">
                <span className="inline-block text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2">
                  At A Glance
                </span>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                  Guest shopper vs VIP member.
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  See what unlocks the moment you activate your membership pass.
                </p>
              </div>

              {/* Mobile-friendly table / comparison */}
              <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40 text-foreground font-semibold">
                        <th className="py-3.5 px-4 sm:px-6">Feature & Perk</th>
                        <th className="py-3.5 px-4 sm:px-6 text-muted-foreground font-normal">Guest</th>
                        <th className="py-3.5 px-4 sm:px-6 text-primary font-semibold bg-primary/5">
                          👑 VIP Member
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {COMPARISON_ROWS.map((row, i) => (
                        <tr key={row.feature} className={i % 2 === 0 ? "bg-secondary/10" : ""}>
                          <td className="py-3.5 px-4 sm:px-6 font-medium text-foreground">
                            {row.feature}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-muted-foreground">
                            {row.guest}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-foreground font-semibold bg-primary/5">
                            <span className="inline-flex items-center gap-1.5 text-primary">
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              {row.vip}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* ── 6. Pricing & Sign-Up Card (Site Theme) ── */}
          <section className="py-12 sm:py-18 bg-white">
            <div className="container mx-auto px-4 sm:px-6 max-w-2xl">
              <div className="bg-gradient-to-br from-secondary/60 via-white to-secondary/40 rounded-3xl p-6 sm:p-10 border border-primary/20 text-center shadow-xs">
                <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-primary/20">
                  <Crown className="h-3.5 w-3.5" />
                  ANNUAL VIP PASS
                </div>

                <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                  Join Complete Home Solution VIP
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Instant activation. Valid across our entire furniture and homewares catalogue for 365 days.
                </p>

                <div className="my-6 py-4 border-y border-border">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-4xl sm:text-5xl font-bold text-foreground">
                      {currencyFmt.format(planPrice)}
                    </span>
                    <span className="text-muted-foreground text-sm">/ {planDuration}</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Equivalent to just ~${(planPrice / 365).toFixed(2)} per day
                  </span>
                </div>

                <div className="space-y-2.5 text-left max-w-md mx-auto mb-6 text-xs sm:text-sm text-foreground">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>5% discount applied automatically on every order (up to $30)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>3-Year Extended Warranty on timber, springs and frames</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Priority dispatch queue from our Adelaide warehouse</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>48-Hour early VIP access to major sale clearances</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Cancel auto-renewal online anytime with 1 click</span>
                  </div>
                </div>

                {checkoutUrl ? (
                  <Link
                    href={checkoutUrl}
                    className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary/90 transition-all text-center"
                  >
                    <Crown className="h-4 w-4" />
                    Become a Member Today
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <p className="text-muted-foreground text-sm">Plans temporarily unavailable.</p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3" /> 256-Bit SSL Encrypted
                  </span>
                  <span>•</span>
                  <span>Westpac OnlinePay Protected</span>
                  <span>•</span>
                  <span>Cancel Anytime</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── 7. Social Proof: Reviews ── */}
          <section className="py-10 sm:py-16 bg-[#f7f3ed] border-y border-border">
            <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
              <div className="max-w-xl mb-8">
                <span className="inline-block text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2">
                  Customer Stories
                </span>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                  Trusted by Australian homes.
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {TESTIMONIALS.map((t) => (
                  <div
                    key={t.name}
                    className="bg-white rounded-2xl p-5 sm:p-6 border border-border shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1 text-amber-500 mb-2.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-xs sm:text-sm text-foreground leading-relaxed italic">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-foreground">{t.name}</p>
                        <p className="text-muted-foreground text-[11px]">{t.location}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {t.saving}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 8. Frequently Asked Questions ── */}
          <section className="py-12 sm:py-20 bg-white">
            <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
              <div className="text-center mb-8">
                <span className="inline-block text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2">
                  Questions & Answers
                </span>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                  Frequently asked questions.
                </h2>
              </div>

              <MembershipFaq />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
