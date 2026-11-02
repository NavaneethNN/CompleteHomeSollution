import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getActiveMembershipPlan, durationLabel } from "@/lib/membership-plan";
import { enforceExpiry, hasActiveMembership } from "@/lib/membership";
import { cacheGet, cacheSet } from "@/lib/redis";
import { MembershipAutopayControls } from "@/components/account/membership-autopay-controls";
import { MembershipSavingsCalculator } from "@/components/account/membership-savings-calculator";
import { MembershipFaq } from "@/components/account/membership-faq";
import {
  Crown,
  CheckCircle2,
  Tag,
  Zap,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Package,
  PhoneCall,
  Star,
  Lock,
  Check,
  ShoppingBag,
  Trophy,
  BookOpen,
  ArrowRight,
  Clock,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";

export const metadata: Metadata = {
  title: "CHS VIP Membership — Exclusive Prices, Raffles & 5% Off",
  description:
    "Join Complete Home Solution VIP. Enjoy exclusive member pricing, entry for exclusive raffles, 5% off up to $30, exclusive blog articles, high priority customer support, and exclusive offers.",
  robots: { index: true, follow: true },
};

const currencyFmt = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
});

const VIP_PERKS = [
  {
    Icon: Sparkles,
    title: "Exclusive Member Price",
    desc: "Unlock promotional pricing across selected timber bed frames, luxury sofas, and dining suites.",
    badge: "Member Prices",
  },
  {
    Icon: Trophy,
    title: "Entry for Exclusive Raffles",
    desc: "Automatic eligibility to enter member-only furniture prize draws and luxury giveaways with zero entry barriers.",
    badge: "VIP Raffles",
  },
  {
    Icon: Tag,
    title: "5% Off Up to $30",
    desc: "Instant 5% discount applied automatically at checkout on every order, saving up to $30 per purchase.",
    badge: "Up to $30 / Order",
  },
  {
    Icon: BookOpen,
    title: "Exclusive Access to Blogs",
    desc: "Read members-only styling guides, Australian interior decor trends, and curated furniture care articles.",
    badge: "Member Articles",
  },
  {
    Icon: PhoneCall,
    title: "High Priority Customer Support",
    desc: "Direct concierge line and prioritized response queue for fast answers to orders and design questions.",
    badge: "Priority Queue",
  },
  {
    Icon: Zap,
    title: "Exclusive Offers",
    desc: "Receive private seasonal promotions, bonus gift incentives, and member-only flash discount events.",
    badge: "Special Deals",
  },
];

const COMPARISON_ROWS = [
  { feature: "Exclusive Member Price", guest: "Standard prices only", vip: "Unlocked across curated furniture" },
  { feature: "Entry for Exclusive Raffles", guest: "Public raffles only", vip: "Full entry to VIP-only raffles" },
  { feature: "5% Off Up to $30", guest: "Retail price (0%)", vip: "5% Off (up to $30 / order)" },
  { feature: "Exclusive Access to Blogs", guest: "Public articles only", vip: "Full access to member articles" },
  { feature: "High Priority Customer Support", guest: "Standard email queue", vip: "Priority phone & direct line" },
  { feature: "Exclusive Offers", guest: "Public promotions only", vip: "Member-only discounts & deals" },
];

const TESTIMONIALS = [
  {
    quote: "Saved $30 on our velvet sofa instantly at checkout. The membership paid for itself before the sofa even left the warehouse!",
    name: "Sarah M.",
    location: "Adelaide, SA",
    saving: "Saved $30 on Order #1",
  },
  {
    quote: "Entered the exclusive member raffle for the armchair and got member-only pricing on our dining table. Outstanding value for $20.",
    name: "David & Kelly K.",
    location: "Melbourne, VIC",
    saving: "Member Price + VIP Raffle",
  },
  {
    quote: "The exclusive blogs gave us brilliant styling ideas for our new home, and high-priority support answered our questions immediately.",
    name: "Marcus L.",
    location: "Sydney, NSW",
    saving: "VIP Blog & Priority Support",
  },
];

type MemberOnlyRaffle = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  bannerImage: string | null;
  images: string[];
  entryPrice: number;
  drawDate: Date;
  prizes: {
    id: string;
    value: number;
    quantity: number;
    images: string[];
  }[];
};

async function getMemberOnlyRaffles(): Promise<MemberOnlyRaffle[]> {
  const cacheKey = "membership:member_only_raffles";
  try {
    const cached = await cacheGet<MemberOnlyRaffle[]>(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached.map((r) => ({
        ...r,
        drawDate: new Date(r.drawDate),
      }));
    }
  } catch {}

  const raffles = await db.raffle.findMany({
    where: {
      visibility: "MEMBERS_ONLY",
      status: { in: ["ACTIVE", "UPCOMING"] },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      shortDescription: true,
      bannerImage: true,
      images: true,
      entryPrice: true,
      drawDate: true,
      prizes: {
        select: {
          id: true,
          value: true,
          quantity: true,
          images: true,
        },
        orderBy: { rank: "asc" },
      },
    },
    orderBy: [
      { isFeatured: "desc" },
      { endDate: "asc" },
    ],
    take: 6,
  });

  try {
    await cacheSet(cacheKey, raffles, 60);
  } catch {}

  return raffles;
}

export default async function MembershipPage() {
  const session = await auth();
  const user = session?.user;

  // Run all queries simultaneously in parallel without any blocking write query
  const [dbUser, activePlan, memberOnlyRaffles] = await Promise.all([
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
    getMemberOnlyRaffles(),
  ]);

  // Non-blocking background expiry cleanup if user's membership has physically passed expiry
  if (user?.id && dbUser?.isMember && dbUser.membershipExpiry && dbUser.membershipExpiry <= new Date()) {
    enforceExpiry(user.id).catch(() => {});
  }

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
                Dashboard
              </Link>
            ) : (
              <Link href="/products" className="hover:text-primary transition-colors">
                Shop
              </Link>
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
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full self-start sm:self-center inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                All Perks Active
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

          {/* Active Member VIP Raffles Section */}
          {memberOnlyRaffles.length > 0 && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-border p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-1.5">
                    <Trophy className="h-3.5 w-3.5" />
                    Exclusive Member Perk
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                    Active VIP Member Raffles
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Your active VIP pass includes complimentary entry to these exclusive luxury furniture prize draws.
                  </p>
                </div>
                <Link
                  href="/raffles"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline self-start sm:self-center"
                >
                  View All Raffles <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {memberOnlyRaffles.map((raffle) => {
                  const mainImage =
                    raffle.bannerImage ||
                    raffle.images?.[0] ||
                    raffle.prizes[0]?.images?.[0] ||
                    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80";
                  const totalPrizeValue = raffle.prizes.reduce((sum, p) => sum + p.value * p.quantity, 0);

                  return (
                    <div
                      key={raffle.id}
                      className="rounded-xl border border-border bg-secondary/20 hover:border-primary/40 transition-colors flex flex-col justify-between overflow-hidden"
                    >
                      <div>
                        <div className="relative aspect-16/10 w-full overflow-hidden bg-secondary">
                          <img
                            src={mainImage}
                            alt={raffle.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2.5 left-2.5">
                            <span className="inline-flex items-center gap-1 bg-stone-900/90 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                              <Crown className="h-3 w-3 text-primary" />
                              VIP Exclusive
                            </span>
                          </div>
                          <div className="absolute top-2.5 right-2.5">
                            <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {raffle.entryPrice === 0 ? "FREE ENTRY" : `$${raffle.entryPrice}`}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 space-y-2">
                          <h3 className="font-semibold text-foreground text-sm line-clamp-1">{raffle.title}</h3>
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/60">
                            <span>Prize value:</span>
                            <span className="font-bold text-foreground">${totalPrizeValue.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 pt-0">
                        <Link
                          href={`/raffles/${raffle.slug}`}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-xs py-2 transition-colors"
                        >
                          <Trophy className="h-3.5 w-3.5" />
                          Enter Raffle (VIP Free Entry)
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                {/* Crown VIP pill and status badge */}
                <div className="flex flex-wrap items-center gap-2 mb-3.5">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider border border-primary/20 whitespace-nowrap">
                    <Crown className="h-3.5 w-3.5 shrink-0" />
                    <span>CHS VIP MEMBERSHIP</span>
                  </div>

                  {isCancelled && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-200/90 text-stone-700 px-3 py-1 text-[11px] sm:text-xs font-semibold border border-stone-300/80 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
                      Status: Cancelled
                    </span>
                  )}

                  {isPaymentFailed && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-[11px] sm:text-xs font-semibold border border-amber-300 whitespace-nowrap">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                      Status: Renewal Lapsed
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.18] mb-3">
                  {isCancelled ? (
                    <>
                      Welcome back. <br />
                      <span className="text-primary font-bold">Reactivate VIP to save 5%.</span>
                    </>
                  ) : isPaymentFailed ? (
                    <>
                      Renew your VIP access. <br />
                      <span className="text-primary font-bold">Restore your 5% discount.</span>
                    </>
                  ) : expiredAt ? (
                    <>Your VIP access has expired. Renew to continue saving.</>
                  ) : (
                    <>
                      Furnish your home for less. <br />
                      <span className="text-primary font-bold">Save 5% on every piece.</span>
                    </>
                  )}
                </h1>

                <p className="text-xs sm:text-base text-muted-foreground leading-relaxed mb-4">
                  {isCancelled
                    ? "Your previous VIP membership was cancelled and autopay was stopped. Reactivate today to instantly restore your 5% order discount, exclusive member prices, and VIP raffle entries."
                    : isPaymentFailed
                    ? "Your membership lapsed because automatic renewal payments could not be completed. Reactivate below with an updated payment card to restore your VIP privileges."
                    : expiredAt
                    ? `Your benefits ended on ${new Date(expiredAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}. Renew today to restore your 5% discount, exclusive member prices, and VIP raffle entries.`
                    : "Join Complete Home Solution VIP. Enjoy exclusive member prices, entry for exclusive raffles, 5% off up to $30, exclusive blog articles, high priority support, and exclusive offers."}
                </p>

                {/* Refined inline status note for cancelled or lapsed members */}
                {(isCancelled || isPaymentFailed) && (
                  <div className="mb-5 rounded-2xl border border-stone-200/90 bg-white/80 backdrop-blur-xs p-3.5 sm:p-4 text-xs text-stone-700 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-semibold text-stone-900">
                          {isCancelled ? "Reactivate anytime • Autopay enabled by default" : "Re-subscribe with updated card"}
                        </p>
                        <p className="text-stone-600 leading-relaxed">
                          {isCancelled
                            ? "When you reactivate, autopay is enabled by default to ensure uninterrupted 5% member savings. You can cancel or pause anytime from your account dashboard with zero penalties."
                            : "Reactivating re-enables autopay by default for continuous coverage, and you can manage your preferences anytime in your account."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick benefit pills on mobile */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2.5 py-3.5 border-y border-border/80 text-[11px] sm:text-xs text-foreground font-medium mb-5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">Exclusive member price</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">Entry for exclusive raffles</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">5% off up to $30</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">Exclusive access to blogs</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PhoneCall className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">High priority support</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">Exclusive offers</span>
                  </div>
                </div>

                {/* Main Hero CTA */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {checkoutUrl ? (
                    <Link
                      href={checkoutUrl}
                      className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 sm:px-8 text-sm sm:text-base font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90 transition-all text-center whitespace-nowrap"
                    >
                      <Crown className="h-4 w-4 shrink-0" />
                      <span>{isCancelled ? `Reactivate VIP — ${currencyFmt.format(planPrice)}/yr` : expiredAt ? "Renew VIP Membership" : `Join VIP — ${currencyFmt.format(planPrice)}/yr`}</span>
                    </Link>
                  ) : (
                    <p className="text-muted-foreground text-sm">Plans temporarily unavailable.</p>
                  )}

                  <span className="text-[11px] sm:text-xs text-muted-foreground text-center sm:text-left whitespace-nowrap">
                    ~${(planPrice / 365).toFixed(2)}/day • Instant activation
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs text-muted-foreground mt-3">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Autopay enabled by default
                  </span>
                  <span>•</span>
                  <span>Cancel anytime in 1 click</span>
                  <span>•</span>
                  <span>Zero cancellation fees</span>
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

                  <p className="text-xs font-semibold text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl text-center border border-emerald-200/60 whitespace-nowrap inline-flex items-center justify-center gap-1.5 w-full">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>$30 saved: Pays for your VIP pass!</span>
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
                      <div className="flex justify-between text-foreground font-medium">
                        <span>Exclusive member price:</span>
                        <span className="text-emerald-700 font-semibold">Unlocked</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground text-sm pt-1">
                        <span>VIP price:</span>
                        <span>$1,370.00</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-primary bg-primary/10 p-2.5 rounded-xl text-center whitespace-nowrap inline-flex items-center justify-center gap-1.5 w-full">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Max $30 savings + Member prices</span>
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

                  <p className="text-xs font-semibold text-foreground bg-white p-2.5 rounded-xl text-center border border-border whitespace-nowrap inline-flex items-center justify-center gap-1.5 w-full">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Instant savings on every single order</span>
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

          {/* ── Member-Only Raffles Section with Ad ── */}
          {memberOnlyRaffles.length > 0 && (
            <section className="py-12 sm:py-18 bg-[#fdfbf9] border-t border-border">
              <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
                {/* Section Header */}
                <div className="max-w-xl mb-8">
                  <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                    <Trophy className="h-3.5 w-3.5" />
                    Exclusive Member Raffles
                  </div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-tight">
                    Exclusive Member-Only Raffles
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
                    Reserved exclusively for active VIP Club subscribers. Win handcrafted designer furniture and homewares with zero entry fees.
                  </p>
                </div>

                {/* Ad Banner Card */}
                <div className="rounded-3xl bg-gradient-to-br from-[#1a2233] to-[#0f1422] text-white p-6 sm:p-8 border border-white/10 shadow-lg mb-8 relative overflow-hidden">
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-2xl space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-white border border-primary/30 text-xs font-bold uppercase tracking-wider">
                        <Crown className="h-3.5 w-3.5 text-primary" />
                        VIP Member Access
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        Subscribe to Unlock This Raffle
                      </h3>
                      <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
                        These prize draws are reserved exclusively for Complete Home Solution VIP subscribers. Subscribe today to immediately unlock free entry into active raffles, plus exclusive member pricing, 5% off every order, exclusive blogs, and high priority support.
                      </p>
                    </div>

                    <div className="shrink-0">
                      {checkoutUrl ? (
                        <Link
                          href={checkoutUrl}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-sm px-7 py-3.5 transition-all shadow-md whitespace-nowrap"
                        >
                          <Crown className="h-4 w-4" />
                          Subscribe to Unlock Raffle
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Raffles Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {memberOnlyRaffles.map((raffle) => {
                    const mainImage =
                      raffle.bannerImage ||
                      raffle.images?.[0] ||
                      raffle.prizes[0]?.images?.[0] ||
                      "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80";
                    const totalPrizeValue = raffle.prizes.reduce((sum, p) => sum + p.value * p.quantity, 0);

                    return (
                      <div
                        key={raffle.id}
                        className="bg-white rounded-2xl border border-border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden group"
                      >
                        <div>
                          {/* Image */}
                          <div className="relative aspect-16/10 w-full overflow-hidden bg-secondary">
                            <img
                              src={mainImage}
                              alt={raffle.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute top-3 left-3">
                              <span className="inline-flex items-center gap-1 bg-stone-900/90 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                                <Crown className="h-3 w-3 text-primary" />
                                VIP Members Only
                              </span>
                            </div>
                            <div className="absolute top-3 right-3">
                              <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                                {raffle.entryPrice === 0 ? "FREE ENTRY" : `$${raffle.entryPrice}`}
                              </span>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="p-5 space-y-3">
                            <h3 className="font-bold text-foreground text-base leading-snug line-clamp-2">
                              {raffle.title}
                            </h3>
                            {raffle.shortDescription && (
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                {raffle.shortDescription}
                              </p>
                            )}

                            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                              <span>Total Prize Value:</span>
                              <span className="font-bold text-foreground text-sm">
                                ${totalPrizeValue.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                Draw Date:
                              </span>
                              <span className="font-medium text-foreground">
                                {new Date(raffle.drawDate).toLocaleDateString("en-AU", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* CTA */}
                        <div className="p-5 pt-0">
                          <Link
                            href={checkoutUrl ?? `/raffles/${raffle.slug}`}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs py-2.5 border border-border transition-colors group-hover:border-primary/40"
                          >
                            <Lock className="h-3.5 w-3.5 text-primary" />
                            Subscribe to Unlock This Raffle
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

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
                          <span className="inline-flex items-center gap-1.5">
                            <Crown className="h-4 w-4 text-primary" />
                            VIP Member
                          </span>
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
                    <span>Exclusive member prices across curated furniture &amp; homewares</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Free entry for exclusive member-only luxury raffles</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>5% discount applied automatically on every order (up to $30)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Exclusive access to interior styling blogs &amp; articles</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>High priority customer support with fast-track routing</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Exclusive offers, seasonal flash deals, and promotions</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Autopay enabled by default — renews annually so savings never lapse</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Cancel auto-renewal online anytime with 1 click in your account</span>
                  </div>
                </div>

                {checkoutUrl ? (
                  <Link
                    href={checkoutUrl}
                    className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90 transition-all text-center whitespace-nowrap"
                  >
                    <Crown className="h-4 w-4 shrink-0" />
                    <span>{isCancelled ? `Reactivate VIP Today — ${currencyFmt.format(planPrice)}/yr` : expiredAt ? "Renew VIP Membership" : `Join VIP Today — ${currencyFmt.format(planPrice)}/yr`}</span>
                  </Link>
                ) : (
                  <p className="text-muted-foreground text-sm">Plans temporarily unavailable.</p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium whitespace-nowrap">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Autopay Enabled by Default
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Lock className="h-3 w-3 text-muted-foreground" /> SSL Encrypted
                  </span>
                  <span>•</span>
                  <span className="whitespace-nowrap">Cancel Anytime</span>
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
