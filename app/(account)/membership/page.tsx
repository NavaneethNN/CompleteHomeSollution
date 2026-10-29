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
    badge: "Most Popular",
  },
  {
    Icon: Sparkles,
    title: "Member-Only Catalog Pricing",
    desc: "Unlock steep promotional discounts on selected timber bed frames, luxury sofas, and dining suites.",
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
    badge: "Speed",
  },
  {
    Icon: Zap,
    title: "48-Hour Early Sale Access",
    desc: "Shop major seasonal events (EOFY, Black Friday, Boxing Day) 2 days before the general public.",
    badge: "VIP First",
  },
  {
    Icon: PhoneCall,
    title: "Dedicated VIP Concierge",
    desc: "Direct telephone and priority email support with our Adelaide styling and logistics specialists.",
    badge: "Direct Line",
  },
];

const COMPARISON_ROWS = [
  { feature: "Everyday Furniture Discount", guest: "Retail Price (0%)", vip: "5% Off (up to $30 / order)" },
  { feature: "Exclusive Member Pricing", guest: "Standard Prices Only", vip: "Unlocked on Curated Items" },
  { feature: "Structural Warranty", guest: "1 Year Standard", vip: "3-Year Extended Warranty" },
  { feature: "Warehouse Handling", guest: "Standard Queue (5–7 Days)", vip: "Priority Express Dispatch" },
  { feature: "Sale Event Access", guest: "Public Release", vip: "48 Hours Early Access" },
  { feature: "Customer Support", guest: "Standard Email Support", vip: "Priority Concierge & Phone" },
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

  // Always read from DB when user is logged in — JWT may be stale after checkout activation
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
    <div className="min-h-screen bg-slate-50/70 pb-20">
      {/* ── Sub-header / Breadcrumbs ── */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            {user ? (
              <Link href="/account/dashboard" className="hover:text-primary transition-colors">
                Account
              </Link>
            ) : (
              <span>Shop</span>
            )}
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-slate-900 font-semibold">VIP Membership</span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5 text-amber-700">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
              Australian Owned
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              100% Satisfaction Guarantee
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-10">
        {/* ── Past status alerts ── */}
        {!isMember && isPaymentFailed && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-900 flex items-start gap-3 shadow-sm">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-950">
                Membership Revoked: Payment Method Failure
              </p>
              <p className="text-red-800 text-xs">
                Your CHS Premium membership was revoked because automatic renewal payments failed after 2 retry attempts. Autopay was cancelled and benefits have ended.
              </p>
              <p className="text-red-700 text-xs font-semibold pt-1">
                You can re-subscribe anytime with an updated payment card below.
              </p>
            </div>
          </div>
        )}

        {!isMember && isCancelled && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-800 flex items-start gap-3 shadow-sm">
            <XCircle className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-slate-900">Membership Cancelled</p>
              <p className="text-slate-600 text-xs">
                Your CHS VIP membership was cancelled manually. Recurring autopay was cancelled and member benefits were stopped.
              </p>
              <p className="text-slate-500 text-xs pt-0.5">
                Ready to return? You can reactivate your membership below anytime.
              </p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════
            ACTIVE MEMBER VIEW
        ════════════════════════════════════════════════════════════════════════ */}
        {isMember ? (
          <div className="space-y-8">
            {/* VIP Member Pass Banner */}
            <div
              className="rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-2xl border border-amber-500/30"
              style={{
                background: "linear-gradient(135deg, #090e17 0%, #111e33 45%, #1a2a44 75%, #2a1f10 100%)",
              }}
            >
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle at 85% 20%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 10% 80%, #ef4444 0%, transparent 40%)",
                }}
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4 sm:gap-5">
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30 text-slate-950 font-black">
                    <Crown className="h-8 w-8 sm:h-10 sm:w-10 text-slate-950" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[11px] font-black px-3 py-0.5 rounded-full border border-emerald-500/40">
                        <CheckCircle2 className="h-3 w-3" /> ACTIVE VIP MEMBER
                      </span>
                      {dbUser?.membershipAutoRenew && (
                        <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[11px] font-bold px-3 py-0.5 rounded-full border border-amber-500/30">
                          AUTOPAY ON
                        </span>
                      )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                      {dbUser?.name ? `${dbUser.name}'s VIP Pass` : "CHS VIP Member"}
                      <Sparkles className="h-5 w-5 text-amber-400" />
                    </h1>

                    <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-md">
                      {memberSince
                        ? `Member since ${new Date(memberSince).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}`
                        : "Your VIP membership is active and enjoying full privileges"}
                    </p>
                  </div>
                </div>

                {/* Quick actions for members */}
                <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
                  <Link
                    href="/products"
                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md transition-all"
                  >
                    <ShoppingBag className="h-4 w-4" /> Shop with Member Prices
                  </Link>
                  <Link
                    href="/account/orders"
                    className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs sm:text-sm px-6 py-3 rounded-xl border border-white/15 transition-all"
                  >
                    <Package className="h-4 w-4" /> View My Orders
                  </Link>
                </div>
              </div>

              {/* Status details bar */}
              <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Everyday Savings</span>
                  <span className="font-bold text-emerald-400 text-sm">5% Off (up to $30)</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Warranty Status</span>
                  <span className="font-bold text-amber-300 text-sm">3-Year Extended</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Dispatch Status</span>
                  <span className="font-bold text-white text-sm">Priority Queue</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Current Plan</span>
                  <span className="font-bold text-white text-sm">
                    {currencyFmt.format(planPrice)} / {planDuration}
                  </span>
                </div>
              </div>
            </div>

            {/* Member Since & Expiry Details */}
            {memberSince && (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Membership Valid Until</p>
                    <p className="text-base font-bold text-slate-900">
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

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-full">
                    ✓ All Benefits Activated
                  </span>
                </div>
              </div>
            )}

            {/* Autopay & Subscription Controls */}
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

            {/* Active Benefits Grid */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  Your VIP Privileges
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  These perks are automatically active on your account across completehomesollution.com.au
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {VIP_PERKS.map(({ Icon, title, desc, badge }) => (
                  <div
                    key={title}
                    className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:border-amber-400/50 hover:bg-amber-50/20 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2.5 py-0.5 rounded-full">
                          {badge}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mb-1">{title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Active on your account
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Calculator for Existing Members */}
            <MembershipSavingsCalculator
              planPrice={planPrice}
              planDuration={planDuration}
              isMember={true}
            />
          </div>
        ) : (
          /* ════════════════════════════════════════════════════════════════════════
              NON-MEMBER / CONVERSION VIEW
          ════════════════════════════════════════════════════════════════════════ */
          <div className="space-y-12 sm:space-y-16">
            {/* ── Section 1: Hero Banner ── */}
            <div
              className="rounded-3xl p-7 sm:p-12 lg:p-16 text-white relative overflow-hidden shadow-2xl border border-amber-500/30"
              style={{
                background: "radial-gradient(ellipse at 80% 20%, #1e293b 0%, #0a0f1d 55%, #05070e 100%)",
              }}
            >
              {/* Background luminous ambient rings */}
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-amber-500/15 via-red-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-3xl">
                {/* Crown VIP pill */}
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold px-3.5 py-1.5 rounded-full mb-5 shadow-sm">
                  <Crown className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                  <span>COMPLETE HOME SOLUTION VIP CLUB</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] mb-5">
                  {expiredAt ? (
                    <>Your VIP Access Has Expired. Renew to Save.</>
                  ) : (
                    <>
                      Furnish Your Home for Less. <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-amber-500">
                        Save 5% on Every Piece.
                      </span>
                    </>
                  )}
                </h1>

                <p className="text-slate-300 text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl mb-8">
                  {expiredAt
                    ? `Your benefits ended on ${new Date(expiredAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}. Renew today to restore your 5% discount, 3-year warranty, and priority dispatch.`
                    : "Join Australia's fastest-growing home lovers club. Enjoy instant 5% savings (up to $30 per order), unlock VIP-only catalog pricing, a 3-Year Extended Warranty, and priority dispatch."}
                </p>

                {/* Trust Points */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2 pb-8 border-y border-white/10 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>5% Off Every Order</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>3-Year Warranty</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>Priority Dispatch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>Cancel Anytime</span>
                  </div>
                </div>

                {/* Hero CTA & Pricing */}
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  {checkoutUrl ? (
                    <Link
                      href={checkoutUrl}
                      className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-base px-8 py-4 rounded-2xl shadow-xl shadow-amber-500/25 transition-all transform hover:-translate-y-0.5"
                    >
                      <Crown className="h-5 w-5" />
                      {expiredAt ? "Renew VIP Membership" : `Become a VIP Member — ${currencyFmt.format(planPrice)}/${planDuration}`}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <p className="text-slate-400 text-sm">Plans temporarily unavailable.</p>
                  )}

                  <div className="text-xs text-slate-400 text-center sm:text-left flex flex-col justify-center">
                    <span className="font-semibold text-slate-300">
                      Just ~${(planPrice / 365).toFixed(2)}/day
                    </span>
                    <span>Pays for itself on order #1 • Instant activation</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin simulation tools even in non-member view so admins can test renewal */}
            {user?.role === "ADMIN" && (
              <div className="bg-white rounded-2xl border border-amber-300 p-6 shadow-sm">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-4">
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
            )}

            {/* ── Section 2: Real-Life Math: "Pays For Itself on Order #1" ── */}
            <div className="space-y-6">
              <div className="text-center max-w-2xl mx-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  The Simple Math
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Pays For Itself on Your Very First Purchase
                </h2>
                <p className="text-slate-600 text-sm mt-2">
                  You don&apos;t have to be a regular decorator to come out ahead. Here&apos;s how our members save on real Complete Home Solution furniture:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Example 1 */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white font-black text-[10px] px-3 py-1 rounded-bl-xl tracking-wider">
                    100% COVERED
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Bedroom
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1">
                      Queen Timber Bed Frame
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Average retail spend: $600</p>

                    <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Standard Price:</span>
                        <span className="line-through text-slate-400 font-medium">$600.00</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>5% VIP Member Discount:</span>
                        <span>-$30.00</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                        <span>VIP Price:</span>
                        <span>$570.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 p-3 rounded-xl text-center">
                    🎉 $30 Saved: Membership 100% paid for!
                  </div>
                </div>

                {/* Example 2 (Featured) */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-amber-400/80 shadow-md relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[10px] px-3 py-1 rounded-bl-xl tracking-wider">
                    BIGGEST VALUE
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                      Living Room
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1">
                      Sectional Corner Lounge
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Average retail spend: $1,400</p>

                    <div className="my-5 p-4 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Standard Price:</span>
                        <span className="line-through text-slate-400 font-medium">$1,400.00</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>5% VIP Discount (Max Cap):</span>
                        <span>-$30.00</span>
                      </div>
                      <div className="flex justify-between text-amber-700 font-semibold">
                        <span>3-Year Extended Warranty:</span>
                        <span>FREE ($99 value)</span>
                      </div>
                      <div className="pt-2 border-t border-amber-200/60 flex justify-between font-bold text-slate-900 text-sm">
                        <span>VIP Price:</span>
                        <span>$1,370.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-amber-900 bg-amber-100/70 border border-amber-300/80 p-3 rounded-xl text-center">
                    💎 $129+ Value Pocketed on Day 1
                  </div>
                </div>

                {/* Example 3 */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 bg-primary text-white font-black text-[10px] px-3 py-1 rounded-bl-xl tracking-wider">
                    CONTINUOUS
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Dining & Decor
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1">
                      Dining Suite & Homewares
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">3 small orders across 12 months: $850</p>

                    <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Combined Standard:</span>
                        <span className="line-through text-slate-400 font-medium">$850.00</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Cumulative VIP Savings:</span>
                        <span>-$42.50</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                        <span>Total Paid:</span>
                        <span>$807.50</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 p-3 rounded-xl text-center">
                    ⭐ Uncapped Savings on Every Order
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 3: Interactive Savings Calculator Widget ── */}
            <MembershipSavingsCalculator
              planPrice={planPrice}
              planDuration={planDuration}
              checkoutUrl={checkoutUrl}
              isMember={false}
            />

            {/* ── Section 4: 6 Core VIP Benefits ── */}
            <div className="space-y-6">
              <div className="text-center max-w-2xl mx-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Exclusive Privileges
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Everything Included in Your VIP Membership
                </h2>
                <p className="text-slate-600 text-sm mt-2">
                  Designed specifically for Australian homeowners who value quality, durability, and great prices.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {VIP_PERKS.map(({ Icon, title, desc, badge }) => (
                  <div
                    key={title}
                    className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-sm hover:shadow-lg hover:border-amber-400/60 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-amber-100 transition-all">
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-bold text-amber-800 bg-amber-100/70 border border-amber-200 px-3 py-1 rounded-full">
                          {badge}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base mb-2 group-hover:text-amber-700 transition-colors">
                        {title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {desc}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                      Included in Annual Pass
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 5: Side-by-Side Comparison ── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-10">
              <div className="max-w-2xl mx-auto text-center mb-8">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Feature Breakdown
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Guest Customer vs CHS VIP Member
                </h2>
                <p className="text-slate-600 text-xs sm:text-sm mt-1">
                  See exactly what changes the moment you activate your VIP membership pass.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs sm:text-sm text-slate-500 font-semibold">
                      <th className="py-4 px-3 sm:px-6">Feature & Perk</th>
                      <th className="py-4 px-3 sm:px-6 text-slate-500">Guest Shopper</th>
                      <th className="py-4 px-3 sm:px-6 bg-amber-50/70 text-amber-900 font-black rounded-t-xl">
                        👑 CHS VIP Member
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {COMPARISON_ROWS.map((row, i) => (
                      <tr key={row.feature} className={i % 2 === 0 ? "bg-slate-50/30" : ""}>
                        <td className="py-4 px-3 sm:px-6 font-semibold text-slate-900">
                          {row.feature}
                        </td>
                        <td className="py-4 px-3 sm:px-6 text-slate-500">
                          {row.guest}
                        </td>
                        <td className="py-4 px-3 sm:px-6 bg-amber-50/40 text-slate-950 font-bold">
                          <span className="inline-flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            {row.vip}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Section 6: Pricing Card (Conversion Anchor) ── */}
            <div className="relative max-w-xl mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 rounded-3xl blur-md opacity-30" />

              <div className="relative bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white rounded-3xl p-8 sm:p-10 border border-amber-500/30 shadow-2xl text-center">
                <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black px-4 py-1.5 rounded-full mb-6">
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                  ANNUAL VIP PASS
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Join Complete Home Solution VIP
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-md mx-auto">
                  Instant activation. Valid across our entire furniture and homewares catalogue for 365 days.
                </p>

                <div className="my-8 py-6 border-y border-white/10">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-amber-400">
                      {currencyFmt.format(planPrice)}
                    </span>
                    <span className="text-slate-400 text-sm">/ {planDuration}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono mt-1 block">
                    Equivalent to just ~${(planPrice / 365).toFixed(2)} per day
                  </span>
                </div>

                <div className="space-y-3 text-left max-w-md mx-auto mb-8 text-xs sm:text-sm text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>5% discount applied automatically on every order (up to $30)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>3-Year Extended Warranty on timber, springs and frames</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Priority dispatch queue from our Adelaide warehouse</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>48-Hour Early VIP access to major sale clearances</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Cancel auto-renewal online anytime with 1 click</span>
                  </div>
                </div>

                {checkoutUrl ? (
                  <Link
                    href={checkoutUrl}
                    className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-base py-4 px-8 rounded-2xl shadow-xl shadow-amber-500/25 transition-all transform hover:-translate-y-0.5"
                  >
                    <Crown className="h-5 w-5" />
                    Become a Member Today
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <p className="text-slate-400 text-sm">Plans temporarily unavailable.</p>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3 text-slate-400" /> 256-Bit SSL Encrypted
                  </span>
                  <span>•</span>
                  <span>Westpac OnlinePay Protected</span>
                  <span>•</span>
                  <span>30-Day Money-Back Guarantee</span>
                </div>
              </div>
            </div>

            {/* ── Section 7: Social Proof & Member Reviews ── */}
            <div className="space-y-6">
              <div className="text-center max-w-2xl mx-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Real Feedback
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Trusted by Australian Homeowners
                </h2>
                <p className="text-slate-600 text-sm mt-1">
                  See what our VIP members have to say about their experience and savings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TESTIMONIALS.map((t) => (
                  <div
                    key={t.name}
                    className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1 text-amber-400 mb-3">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-amber-400" />
                        ))}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{t.name}</p>
                        <p className="text-slate-500 text-[11px]">{t.location}</p>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                        {t.saving}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 8: Frequently Asked Questions ── */}
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Got Questions?
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Frequently Asked Questions
                </h2>
                <p className="text-slate-600 text-xs sm:text-sm mt-1">
                  Have questions about your membership? We have answers.
                </p>
              </div>

              <MembershipFaq />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
