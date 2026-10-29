import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getActiveMembershipPlan, durationLabel } from "@/lib/membership-plan";
import { enforceExpiry, hasActiveMembership } from "@/lib/membership";
import { MembershipAutopayControls } from "@/components/account/membership-autopay-controls";
import {
  Crown, CheckCircle2, ShieldCheck, Tag, Zap,
  CalendarDays, ChevronRight, ArrowRight, Sparkles, AlertCircle, XCircle, Package,
} from "lucide-react";

const currencyFmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 });

const BASE_PERKS = [
  { Icon: Tag,         title: "Member-exclusive discounts", desc: "Exclusive member prices or 5% off (up to $30) on every item" },
  { Icon: ShieldCheck, title: "3-year extended warranty",   desc: "Double the standard warranty on all purchases" },
  { Icon: Zap,         title: "Early access to sales",      desc: "Shop new arrivals and sale events before everyone else" },
] as const;

export default async function MembershipPage() {
  const session = await auth();
  const user = session!.user;

  await enforceExpiry(user.id);

  // Always read from DB — JWT may be stale after checkout activation
  const [dbUser, activePlan] = await Promise.all([
    db.user.findUnique({
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
      },
    }),
    getActiveMembershipPlan(),
  ]);

  // Enforce expiry via central utility
  const isMember = hasActiveMembership(dbUser);
  const memberSince = dbUser?.memberSince;
  const expiredAt = dbUser?.membershipExpiry && dbUser.membershipExpiry <= new Date()
    ? dbUser.membershipExpiry
    : null;
  const planPrice = activePlan?.price ?? 30;
  const planName = activePlan?.name ?? "Premium";
  const planDuration = activePlan ? durationLabel(activePlan.durationDays) : "year";
  const planDiscount = activePlan?.discountPercent ?? 30;
  const PERKS = [
    { Icon: Tag, title: `Up to ${planDiscount}% off every order`, desc: "Member-only prices applied automatically at checkout" },
    ...BASE_PERKS,
  ];

  const isCancelled = dbUser?.membershipStatus === "CANCELLED";
  const isPaymentFailed = dbUser?.membershipStatus === "REVOKED_PAYMENT_FAILURE";

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/account/dashboard" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Membership</span>
        </div>

        {/* ── Main content ── */}
        <main className="space-y-6">

            {/* Status alerts for past cancellations / revocations */}
            {!isMember && isPaymentFailed && (
              <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-900 flex items-start gap-3 shadow-sm">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-red-950">
                    Membership Revoked: Payment Method Failure Issue
                  </p>
                  <p className="text-red-800 text-xs">
                    Your CHS Premium membership was revoked because automatic renewal payments failed after 2 retry attempts on different days (due to insufficient funds or card decline). Autopay was cancelled and benefits have been stopped.
                  </p>
                  <p className="text-red-700 text-xs font-semibold pt-1">
                    You can re-subscribe anytime with an updated payment method below.
                  </p>
                </div>
              </div>
            )}

            {!isMember && isCancelled && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-800 flex items-start gap-3 shadow-sm">
                <XCircle className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">
                    Membership Cancelled
                  </p>
                  <p className="text-slate-600 text-xs">
                    Your CHS Premium membership was cancelled manually. Recurring autopay was cancelled and all member benefits were revoked immediately.
                  </p>
                  <p className="text-slate-500 text-xs pt-0.5">
                    Want to join again? You can activate a new membership below anytime.
                  </p>
                </div>
              </div>
            )}

            {isMember ? (
              /* ── ACTIVE MEMBER VIEW ── */
              <>
                {/* Active banner */}
                <div className="rounded-2xl p-7 text-white relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #7f1d1d 100%)" }}
                >
                  <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #ef4444 0%, transparent 60%)" }}
                  />
                  <div className="relative z-10 flex items-start gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                      <Crown className="h-7 w-7 text-amber-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> ACTIVE
                        </span>
                        {dbUser?.membershipAutoRenew && (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            AUTOPAY ON
                          </span>
                        )}
                      </div>
                      <h1 className="text-2xl font-black mb-1 flex items-center gap-2">
                        CHS Premium Member
                        <Sparkles className="h-5 w-5 text-amber-300" />
                      </h1>
                      <p className="text-white/65 text-sm">
                        {memberSince
                          ? `Member since ${new Date(memberSince).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}`
                          : "Your membership is active"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Member since card */}
                {memberSince && (
                  <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                      <CalendarDays className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Member since</p>
                      <p className="font-bold text-foreground">
                        {new Date(memberSince).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">{planName}</span>
                    </div>
                  </div>
                )}

                {/* Autopay & Cancellation Management */}
                <MembershipAutopayControls
                  isMember={isMember}
                  initialAutoRenew={dbUser?.membershipAutoRenew ?? true}
                  membershipExpiry={dbUser?.membershipExpiry ? dbUser.membershipExpiry.toISOString() : null}
                  membershipStatus={dbUser?.membershipStatus ?? null}
                  membershipCancelReason={dbUser?.membershipCancelReason ?? null}
                  retryCount={dbUser?.membershipRetryCount ?? 0}
                  nextRetryAt={dbUser?.membershipNextRetryAt ? dbUser.membershipNextRetryAt.toISOString() : null}
                  isAdmin={user.role === "ADMIN"}
                />

                {/* Active perks grid */}
                <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-border">
                    <h2 className="font-bold text-foreground">Your Member Benefits</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">All active on your account right now</p>
                  </div>
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PERKS.map(({ Icon, title, desc }) => (
                      <div key={title} className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            {title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/products"
                    className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3 px-6 rounded-xl transition-colors"
                  >
                    <Tag className="h-4 w-4" /> Shop with Member Prices
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/account/orders"
                    className="flex-1 flex items-center justify-center gap-2 border border-border bg-white hover:bg-secondary text-foreground font-semibold text-sm py-3 px-6 rounded-xl transition-colors"
                  >
                    <Package className="h-4 w-4" /> View My Orders
                  </Link>
                </div>
              </>
            ) : (
              /* ── NON-MEMBER UPGRADE VIEW ── */
              <>
                <div className="rounded-2xl p-7 text-white relative overflow-hidden"
                  style={{ backgroundColor: "var(--navy)" }}
                >
                  <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: "radial-gradient(circle at 80% 50%, var(--color-primary) 0%, transparent 60%)" }}
                  />
                  <div className="relative z-10">
                    <p className="text-white/60 text-sm mb-1">Membership</p>
                    <h1 className="text-2xl xl:text-3xl font-black mb-2">
                      {expiredAt ? "Your CHS Premium membership has expired" : "Unlock CHS Premium"}
                    </h1>
                    <p className="text-white/60 text-sm max-w-md">
                      {expiredAt
                        ? `Your benefits ended on ${new Date(expiredAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}. Renew today to restore your savings and perks.`
                        : "Join thousands of Australians saving with exclusive member prices or 5% off (up to $30) on premium furniture with CHS Premium membership."}
                    </p>
                    {activePlan ? (
                      <Link
                        href={`/membership/checkout?planId=${activePlan.id}`}
                        className="inline-flex items-center gap-2 mt-4 bg-primary hover:bg-primary/90 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                      >
                        <Crown className="h-4 w-4" /> {expiredAt ? "Renew Membership" : `Join for ${currencyFmt.format(planPrice)}/${planDuration}`}
                      </Link>
                    ) : (
                      <p className="mt-4 text-white/60 text-sm">No plans available — check back soon.</p>
                    )}
                  </div>
                </div>

                {/* Admin simulation tools even in non-member view so admins can test renewal */}
                {user.role === "ADMIN" && (
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
                )}

                <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-border">
                    <h2 className="font-bold text-foreground">What you get</h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PERKS.map(({ Icon, title, desc }) => (
                      <div key={title} className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 pb-6">
                    {activePlan ? (
                      <Link
                        href={`/membership/checkout?planId=${activePlan.id}`}
                        className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3 rounded-xl transition-colors"
                      >
                        <Crown className="h-4 w-4" /> {expiredAt ? "Renew Membership" : `Become a Member — ${currencyFmt.format(planPrice)}/${planDuration}`}
                      </Link>
                    ) : (
                      <p className="text-center text-sm text-muted-foreground py-2">No membership plans available right now.</p>
                    )}
                  </div>
                </div>
              </>
            )}

          </main>
      </div>
    </div>
  );
}
