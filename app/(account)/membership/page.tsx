import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getActiveMembershipPlan, durationLabel } from "@/lib/membership-plan";
import { activateMembership, enforceExpiry } from "@/lib/membership";
import {
  Crown, CheckCircle2, Truck, ShieldCheck, Tag, Zap,
  CalendarDays, ChevronRight, LayoutDashboard, Package,
  UserCircle, MapPin, ArrowRight, Sparkles,
} from "lucide-react";

export const metadata: Metadata = { title: "Membership — Complete Home Sollution" };

const NAV_LINKS = [
  { label: "Dashboard",  href: "/account/dashboard",  Icon: LayoutDashboard },
  { label: "My Orders",  href: "/account/orders",     Icon: Package },
  { label: "Membership", href: "/account/membership", Icon: Crown },
  { label: "Profile",    href: "/account/profile",    Icon: UserCircle },
  { label: "Addresses",  href: "/account/addresses",  Icon: MapPin },
] as const;

const currencyFmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 });

const BASE_PERKS = [
  { Icon: Truck,       title: "Free express delivery",    desc: "Free shipping on all orders, regardless of cart size" },
  { Icon: ShieldCheck, title: "3-year extended warranty", desc: "Double the standard warranty on all purchases" },
  { Icon: Zap,         title: "Early access to sales",    desc: "Shop new arrivals and sale events before everyone else" },
] as const;

export default async function MembershipPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; session_id?: string; cancelled?: string }>;
}) {
  const session = await auth();
  const user = session!.user;
  const params = await searchParams;

  if (params?.success === "1" && params?.session_id) {
    try {
      const stripe = getStripe();
      const stripeSession = await stripe.checkout.sessions.retrieve(params.session_id);
      if (
        stripeSession.payment_status === "paid" &&
        stripeSession.metadata?.type === "membership" &&
        stripeSession.metadata?.userId === user.id
      ) {
        await activateMembership({
          userId: user.id,
          planId: stripeSession.metadata?.planId ?? null,
          stripeSessionId: params.session_id,
          amountPaid: (stripeSession.amount_total ?? 0) / 100,
        });
      }
    } catch (e) {
      console.error("[membership page] Failed to verify Stripe session", e);
    }
  }

  // Always read from DB — JWT may be stale after checkout activation
  const [dbUser, activePlan] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { isMember: true, memberSince: true, name: true },
    }),
    getActiveMembershipPlan(),
  ]);

  // Enforce expiry via central utility
  const wasRevoked = await enforceExpiry(user.id);
  const isMember = (dbUser?.isMember ?? false) && !wasRevoked;
  const memberSince = dbUser?.memberSince;
  const planPrice = activePlan?.price ?? 30;
  const planName = activePlan?.name ?? "Premium";
  const planDuration = activePlan ? durationLabel(activePlan.durationDays) : "year";
  const planDiscount = activePlan?.discountPercent ?? 30;
  const PERKS = [
    { Icon: Tag, title: `Up to ${planDiscount}% off every order`, desc: "Member-only prices applied automatically at checkout" },
    ...BASE_PERKS,
  ];

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Sidebar ── */}
          <aside className="lg:w-60 xl:w-64 shrink-0">
            <div
              className="rounded-2xl p-6 mb-4 flex flex-col items-center text-center text-white"
              style={{ backgroundColor: "var(--navy)" }}
            >
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center ring-4 ring-white/20 mb-3">
                <span className="text-2xl font-black text-white">{initials}</span>
              </div>
              <p className="font-bold text-base leading-tight">{user.name ?? "Welcome"}</p>
              <p className="text-white/55 text-xs mt-0.5 truncate max-w-full">{user.email}</p>
              {isMember && (
                <span className="mt-3 inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 text-[11px] font-bold px-3 py-1 rounded-full">
                  <Crown className="h-3 w-3" /> MEMBER
                </span>
              )}
            </div>
            <nav className="bg-white rounded-2xl overflow-hidden border border-border shadow-sm">
              {NAV_LINKS.map(({ label, href, Icon }, i) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors group
                    ${href === "/account/membership"
                      ? "bg-primary/8 text-primary border-l-[3px] border-primary"
                      : "text-foreground hover:bg-secondary hover:text-primary border-l-[3px] border-transparent"}
                    ${i !== 0 ? "border-t border-border" : ""}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </nav>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0 space-y-6">

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
                    <h1 className="text-2xl xl:text-3xl font-black mb-2">Unlock CHS Premium</h1>
                    <p className="text-white/60 text-sm max-w-md">
                      Join thousands of Australians saving up to 30% on premium furniture with CHS Premium membership.
                    </p>
                    {activePlan ? (
                      <Link
                        href="/account/membership/checkout"
                        className="inline-flex items-center gap-2 mt-4 bg-primary hover:bg-primary/90 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                      >
                        <Crown className="h-4 w-4" /> Join for {currencyFmt.format(planPrice)}/{planDuration}
                      </Link>
                    ) : (
                      <p className="mt-4 text-white/60 text-sm">No plans available — check back soon.</p>
                    )}
                  </div>
                </div>

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
                        href="/account/membership/checkout"
                        className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3 rounded-xl transition-colors"
                      >
                        <Crown className="h-4 w-4" /> Become a Member — {currencyFmt.format(planPrice)}/{planDuration}
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
    </div>
  );
}
