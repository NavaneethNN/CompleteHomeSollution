import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { MembershipCheckoutForm } from "@/components/account/membership-checkout-form";

export default async function MembershipCheckoutPage({ searchParams }: { searchParams: Promise<{ planId?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/membership/checkout");
  const { planId } = await searchParams;
  const plan = planId ? await db.membershipPlan.findFirst({ where: { id: planId, isActive: true } })
    : await db.membershipPlan.findFirst({ where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { price: "asc" }] });
  if (!plan) return <p className="p-8">Membership is currently unavailable.</p>;
  return <main className="mx-auto max-w-lg px-4 py-10">
    <h1 className="text-2xl font-bold">{plan.name} membership</h1>
    <p className="my-3">A${plan.price.toFixed(2)} for {plan.durationDays} days. Enter your billing details to continue to secure payment.</p>
    <MembershipCheckoutForm planId={plan.id} />
  </main>;
}
