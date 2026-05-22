import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  Crown, ChevronRight, Star, Truck, ShieldCheck,
  ChevronLeft, Home, Check, X, Zap, Gift, BadgePercent,
  HeadphonesIcon, PackageCheck, CalendarCheck, RefreshCw,
} from "lucide-react";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { MembershipBuyButton } from "@/components/account/membership-buy-button";
import { getActiveMembershipPlans, durationLabel } from "@/lib/membership-plan";
import type { ActivePlan } from "@/lib/membership-plan";

export const metadata: Metadata = { title: "Membership - Complete Home Sollution" };

const PERKS = [
  { Icon: BadgePercent,   title: "Member Pricing",           desc: "Exclusive discounts automatically applied at checkout." },
  { Icon: Truck,          title: "Free Express Delivery",    desc: "Free express shipping on all orders over $200." },
  { Icon: ShieldCheck,    title: "Extended 3-Year Warranty", desc: "Double the standard warranty on all purchases." },
  { Icon: HeadphonesIcon, title: "Priority Support",         desc: "Dedicated member support, 7 days a week." },
  { Icon: Gift,           title: "Birthday Bonus",           desc: "15% exclusive birthday discount every year." },
  { Icon: Zap,            title: "Early Access",             desc: "First access to new arrivals and sales." },
];

const COMPARE_ROWS = [
  { label: "Member pricing discounts",             member: true,  standard: false },
  { label: "Free express delivery over $200",      member: true,  standard: false },
  { label: "Standard free delivery over $1,200",   member: true,  standard: true  },
  { label: "3-year extended warranty",             member: true,  standard: false },
  { label: "Standard 1-year warranty",             member: true,  standard: true  },
  { label: "Priority customer support",            member: true,  standard: false },
  { label: "Early access to new arrivals & sales", member: true,  standard: false },
  { label: "Birthday discount (15%)",              member: true,  standard: false },
];

const TESTIMONIALS = [
  { name: "Sarah M.", location: "Sydney, NSW",    quote: "Paid for itself on my first order. Saved $240 on a sofa. Absolute no-brainer.", stars: 5 },
  { name: "James K.", location: "Melbourne, VIC", quote: "The priority support alone is worth it. Had an issue resolved same day.",        stars: 5 },
  { name: "Priya L.", location: "Brisbane, QLD",  quote: "Free express shipping every order? Already saved way more than the fee.",       stars: 5 },
];

const currFmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 });

function PlanCard({ plan, isBestValue, isRenewal = false, currentExpiry }: { plan: ActivePlan; isBestValue: boolean; isRenewal?: boolean; currentExpiry?: Date | null }) {
  const dur = durationLabel(plan.durationDays);
  const monthlyEquiv = plan.durationDays === 365 ? (plan.price / 12).toFixed(2) : null;
  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isBestValue ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
      {isBestValue && (
        <div className="bg-primary text-primary-foreground text-[11px] font-bold text-center py-1.5 tracking-widest uppercase">
          {isRenewal ? "Recommended" : "Best Value"}
        </div>
      )}
      <div className="p-6 flex flex-col gap-4 flex-1">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base leading-tight">{plan.name}</h3>
            {plan.description && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{plan.description}</p>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-foreground tracking-tight">{currFmt.format(plan.price)}</span>
            <span className="text-sm text-muted-foreground font-medium">/ {dur}</span>
          </div>
          {monthlyEquiv && (
            <p className="text-xs text-muted-foreground mt-1">${monthlyEquiv} / month</p>
          )}
        </div>

        <ul className="space-y-2.5 flex-1">
          {plan.discountPercent > 0 && (
            <li className="flex items-center gap-2.5 text-sm">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Check className="h-3 w-3 text-green-600" />
              </div>
              <span className="text-foreground">Up to <strong>{plan.discountPercent}%</strong> off every order</span>
            </li>
          )}
          {[
            "Free express delivery over $200",
            "3-year extended warranty",
            "Priority support & early access",
            `${dur} membership - activates instantly`,
          ].map((perk) => (
            <li key={perk} className="flex items-center gap-2.5 text-sm">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Check className="h-3 w-3 text-green-600" />
              </div>
              <span className="text-foreground">{perk}</span>
            </li>
          ))}
        </ul>

        <div className="pt-2 border-t border-border">
          {isRenewal && (() => {
            const base = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
            const newExpiry = new Date(base);
            newExpiry.setDate(newExpiry.getDate() + plan.durationDays);
            return (
              <p className="text-xs text-muted-foreground text-center mb-2">
                New expiry: <span className="font-semibold text-foreground">{newExpiry.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
              </p>
            );
          })()}
          <MembershipBuyButton
            planId={plan.id}
            label={isRenewal ? `Renew - ${currFmt.format(plan.price)}` : `Get ${plan.name} - ${currFmt.format(plan.price)}`}
            variant={isBestValue ? "primary" : "outline"}
          />
          <p className="text-[10px] text-muted-foreground text-center mt-2">Secure checkout via Stripe</p>
        </div>
      </div>
    </div>
  );
}

export default async function MembershipPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; cancelled?: string; session_id?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const resolvedSearch = await searchParams;
  const justJoined = resolvedSearch?.success === "1";
  const cancelled   = resolvedSearch?.cancelled === "1";
  const stripeSessionId = resolvedSearch && "session_id" in resolvedSearch
    ? (resolvedSearch as Record<string, string>).session_id
    : undefined;

  // If returning from Stripe with a session_id, verify payment and activate/renew
  // membership immediately — don't wait for the webhook (race condition fix)
  if (justJoined && stripeSessionId) {
    try {
      const stripe = getStripe();
      const stripeSession = await stripe.checkout.sessions.retrieve(stripeSessionId);
      if (
        stripeSession.payment_status === "paid" &&
        stripeSession.metadata?.type === "membership" &&
        stripeSession.metadata?.userId === session.user.id
      ) {
        const planId = stripeSession.metadata?.planId;
        const plan = planId
          ? await db.membershipPlan.findUnique({ where: { id: planId }, select: { durationDays: true } })
          : await db.membershipPlan.findFirst({ where: { isActive: true }, select: { durationDays: true }, orderBy: { price: "asc" } });
        const durationDays = plan?.durationDays ?? 365;
        // Fetch current expiry to handle renewal (extend from existing, not from today)
        const existing = await db.user.findUnique({
          where: { id: session.user.id },
          select: { isMember: true, memberSince: true, membershipExpiry: true },
        });
        const now = new Date();
        const baseDate = existing?.membershipExpiry && existing.membershipExpiry > now
          ? existing.membershipExpiry
          : now;
        const expiry = new Date(baseDate);
        expiry.setDate(expiry.getDate() + durationDays);
        await db.user.update({
          where: { id: session.user.id },
          data: {
            isMember: true,
            memberSince: existing?.isMember ? existing.memberSince : now,
            membershipExpiry: expiry,
          },
        });
      }
    } catch (e) {
      console.error("[membership page] stripe session verify failed", e);
    }
  }

  const [dbUser, plans] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { isMember: true, memberSince: true, membershipExpiry: true, name: true, email: true },
    }),
    getActiveMembershipPlans(),
  ]);

  const isMember         = dbUser?.isMember ?? session.user.isMember ?? false;
  const memberSince      = dbUser?.memberSince;
  const membershipExpiry = dbUser?.membershipExpiry ?? null;

  const defaultPlan = plans.find((p) => (p as ActivePlan & { isDefault?: boolean }).isDefault) ?? plans[0];
  const hasPlans    = plans.length > 0;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-4 lg:py-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 lg:mb-6">
          <Link href="/account/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-1.5 text-sm">
            <Home className="h-3.5 w-3.5 text-muted-foreground" />
            <Link href="/account/dashboard" className="text-muted-foreground hover:text-primary transition-colors">Dashboard</Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium">Membership</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <AccountSidebar user={{ ...session.user, isMember }} />

          <main className="flex-1 min-w-0 space-y-6">

            {/* ── Success banner ── */}
            {justJoined && (
              <div className="flex items-start gap-3 rounded-2xl bg-green-50 border border-green-200 px-5 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">Welcome to CHS Premium!</p>
                  <p className="text-sm text-green-700 mt-0.5">Your membership is now active. Member pricing is automatically applied at checkout.</p>
                </div>
              </div>
            )}

            {/* ── Cancelled banner ── */}
            {cancelled && !isMember && (
              <div className="flex items-start gap-3 rounded-2xl bg-secondary border border-border px-5 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Crown className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Payment cancelled</p>
                  <p className="text-sm text-muted-foreground mt-0.5">No charge was made. You can join whenever you are ready.</p>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════
                MEMBER VIEW
            ════════════════════════════════════════ */}
            {isMember && (
              <>
                {/* Membership status card */}
                <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Crown className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">CHS Premium Membership</p>
                        <p className="text-sm text-muted-foreground">{dbUser?.name ?? session.user.name ?? "Member"} &middot; {dbUser?.email ?? session.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">Active</span>
                      {memberSince && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarCheck className="h-3.5 w-3.5" />
                          Since {new Date(memberSince).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expiry / progress bar */}
                  {membershipExpiry && (() => {
                    const now = new Date();
                    const expiry = new Date(membershipExpiry);
                    const totalMs = expiry.getTime() - (memberSince ? new Date(memberSince).getTime() : expiry.getTime() - 365 * 86400000);
                    const remainMs = Math.max(0, expiry.getTime() - now.getTime());
                    const daysLeft = Math.ceil(remainMs / 86400000);
                    const pct = Math.min(100, Math.max(0, Math.round((remainMs / totalMs) * 100)));
                    const isExpiringSoon = daysLeft <= 30;
                    return (
                      <div className="px-6 py-4 border-b border-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Membership Validity</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isExpiringSoon ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-green-50 text-green-700 border border-green-200"
                          }`}>
                            {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left` : "Expired"}
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isExpiringSoon ? "bg-amber-400" : "bg-green-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[11px] text-muted-foreground">
                            {memberSince ? `Started ${new Date(memberSince).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Expires {expiry.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        {isExpiringSoon && daysLeft > 0 && (
                          <p className="text-xs text-amber-600 font-medium mt-2">Your membership expires soon. Renew below to keep your benefits.</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Active benefits list */}
                  <div className="px-6 pt-5 pb-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Your Active Benefits</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PERKS.map(({ Icon, title, desc }) => (
                        <div key={title} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-foreground">{title}</p>
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shop now footer */}
                  <div className="px-6 py-5">
                    <Link
                      href="/products"
                      className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-5 py-2.5 transition-colors shadow-sm"
                    >
                      <PackageCheck className="h-4 w-4" /> Shop Now &amp; Save
                    </Link>
                  </div>
                </div>

                {/* Renewal section */}
                {hasPlans && (
                  <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      <div>
                        <h2 className="text-base font-bold text-foreground">Renew Your Membership</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Extend your membership to keep all your benefits uninterrupted.</p>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className={`grid gap-4 ${
                        plans.length === 1 ? "grid-cols-1 max-w-sm" :
                        plans.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
                        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                      }`}>
                        {plans.map((plan) => (
                          <PlanCard key={plan.id} plan={plan} isBestValue={defaultPlan?.id === plan.id} isRenewal currentExpiry={membershipExpiry} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ════════════════════════════════════════
                NON-MEMBER VIEW
            ════════════════════════════════════════ */}
            {!isMember && (
              <>
                {/* Hero header */}
                <div className="rounded-2xl border border-border bg-white shadow-sm px-6 py-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Crown className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-widest mb-1">
                        <Star className="h-3 w-3 fill-primary" /> CHS Premium Membership
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight">Save More on Every Order</h1>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                        One membership. Instant member pricing, free express delivery, extended warranty, and more on every order, every day.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Plan cards */}
                <div>
                  <h2 className="text-base font-bold text-foreground mb-3">Choose Your Plan</h2>
                  {hasPlans ? (
                    <div className={`grid gap-4 ${
                      plans.length === 1 ? "grid-cols-1 max-w-sm" :
                      plans.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
                      "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    }`}>
                      {plans.map((plan) => (
                        <PlanCard key={plan.id} plan={plan} isBestValue={defaultPlan?.id === plan.id} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-white shadow-sm px-6 py-10 text-center">
                      <Crown className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="font-semibold text-foreground">No plans available right now</p>
                      <p className="text-sm text-muted-foreground mt-1">Check back soon - new membership plans are coming.</p>
                    </div>
                  )}
                </div>

                {/* Benefits grid */}
                <div className="rounded-2xl border border-border bg-white shadow-sm p-6">
                  <h2 className="text-lg font-black text-foreground mb-1">Everything You Get</h2>
                  <p className="text-sm text-muted-foreground mb-5">Six exclusive perks included with every CHS membership.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {PERKS.map(({ Icon, title, desc }) => (
                      <div key={title} className="flex items-start gap-3 p-4 rounded-xl bg-secondary/40 border border-border hover:border-primary/30 transition-colors">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comparison table */}
                <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-black text-foreground">Member vs. Standard</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">See exactly what you unlock with membership.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Feature</th>
                          <th className="px-4 py-3 text-center font-bold text-primary w-32">
                            <div className="flex items-center justify-center gap-1.5"><Crown className="h-3.5 w-3.5" /> Member</div>
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-32">Standard</th>
                        </tr>
                      </thead>
                      <tbody>
                        {COMPARE_ROWS.map(({ label, member, standard }, i) => (
                          <tr key={label} className={i % 2 === 0 ? "bg-white" : "bg-secondary/20"}>
                            <td className="px-6 py-3 text-foreground">{label}</td>
                            <td className="px-4 py-3 text-center">
                              {member ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {standard ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Testimonials */}
                <div className="rounded-2xl border border-border bg-white shadow-sm p-6">
                  <h2 className="text-lg font-black text-foreground mb-5">What Members Say</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {TESTIMONIALS.map(({ name, location, quote, stars }) => (
                      <div key={name} className="rounded-xl bg-secondary/40 border border-border p-4">
                        <div className="flex gap-0.5 mb-3">
                          {Array.from({ length: stars }).map((_, i) => (
                            <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                          ))}
                        </div>
                        <p className="text-sm text-foreground italic leading-relaxed">&ldquo;{quote}&rdquo;</p>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{name[0]}</div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{name}</p>
                            <p className="text-xs text-muted-foreground">{location}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}