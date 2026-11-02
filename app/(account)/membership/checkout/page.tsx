import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Crown, CheckCircle2, ArrowLeft } from "lucide-react";
import { MembershipCheckoutForm } from "@/components/account/membership-checkout-form";

export default async function MembershipCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/membership/checkout");

  const { planId } = await searchParams;
  const plan = planId
    ? await db.membershipPlan.findFirst({ where: { id: planId, isActive: true } })
    : await db.membershipPlan.findFirst({
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { price: "asc" }],
      });

  if (!plan) return <p className="p-8">Membership is currently unavailable.</p>;

  return (
    <div className="min-h-screen bg-stone-50/50 py-8 sm:py-12">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        <Link
          href="/membership"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Membership Overview</span>
        </Link>

        {/* Plan Summary Card */}
        <div className="bg-white rounded-2xl border border-border shadow-xs p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground leading-tight">{plan.name} Membership</h1>
                <p className="text-xs text-muted-foreground">Billed annually • Instant VIP privileges</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-foreground">
                ${plan.price.toFixed(2)}
              </div>
              <span className="text-[11px] text-muted-foreground">for {plan.durationDays} days</span>
            </div>
          </div>

          <div className="border-t border-border/70 pt-3.5 space-y-2 text-xs text-stone-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>5% off every order (up to $30 per purchase)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>3-Year Extended Warranty on timber frames and springs</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Priority dispatch from Adelaide warehouse</span>
            </div>
          </div>
        </div>

        {/* Checkout Form */}
        <div className="bg-white rounded-2xl border border-border shadow-xs p-5 sm:p-6">
          <h2 className="text-sm font-bold text-foreground mb-4">Billing & Contact Information</h2>
          <MembershipCheckoutForm planId={plan.id} />
        </div>
      </div>
    </div>
  );
}
