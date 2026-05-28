import { db } from "@/lib/db";

export type ActivePlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  discountPercent: number;
};

/** Returns all active plans sorted by price ascending. */
export async function getActiveMembershipPlans(): Promise<ActivePlan[]> {
  return db.membershipPlan.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true, price: true, durationDays: true, discountPercent: true },
    orderBy: { price: "asc" },
  });
}

/** Returns the default active plan, falling back to cheapest active, or null if none exist. */
export async function getActiveMembershipPlan(): Promise<ActivePlan | null> {
  const plan = await db.membershipPlan.findFirst({
    where: { isActive: true, isDefault: true },
    select: { id: true, name: true, description: true, price: true, durationDays: true, discountPercent: true },
    orderBy: { createdAt: "asc" },
  });
  if (plan) return plan;

  return db.membershipPlan.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, description: true, price: true, durationDays: true, discountPercent: true },
    orderBy: { price: "asc" },
  });
}

export function durationLabel(days: number): string {
  if (days >= 36500) return "Lifetime";
  if (days % 365 === 0) return `${days / 365} year${days / 365 > 1 ? "s" : ""}`;
  if (days % 30 === 0)  return `${days / 30} month${days / 30 > 1 ? "s" : ""}`;
  return `${days} days`;
}
