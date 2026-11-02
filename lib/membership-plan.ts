import { db } from "@/lib/db";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

export type ActivePlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  discountPercent: number;
};

export const ACTIVE_PLAN_CACHE_KEY = "membership:active_plan";
export const ALL_ACTIVE_PLANS_CACHE_KEY = "membership:active_plans:all";
const PLAN_CACHE_TTL_SECONDS = 300; // 5 minutes

/** Returns all active plans sorted by price ascending with L1/L2 caching. */
export async function getActiveMembershipPlans(): Promise<ActivePlan[]> {
  const cached = await cacheGet<ActivePlan[]>(ALL_ACTIVE_PLANS_CACHE_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  const plans = await db.membershipPlan.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true, price: true, durationDays: true, discountPercent: true },
    orderBy: { price: "asc" },
  });

  if (plans.length > 0) {
    await cacheSet(ALL_ACTIVE_PLANS_CACHE_KEY, plans, PLAN_CACHE_TTL_SECONDS);
  }

  return plans;
}

/** Returns the default active plan, falling back to cheapest active, or null if none exist with L1/L2 caching. */
export async function getActiveMembershipPlan(): Promise<ActivePlan | null> {
  const cached = await cacheGet<ActivePlan>(ACTIVE_PLAN_CACHE_KEY);
  if (cached && cached.id) {
    return cached;
  }

  const plan = await db.membershipPlan.findFirst({
    where: { isActive: true, isDefault: true },
    select: { id: true, name: true, description: true, price: true, durationDays: true, discountPercent: true },
    orderBy: { createdAt: "asc" },
  });

  const resolved = plan || (await db.membershipPlan.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, description: true, price: true, durationDays: true, discountPercent: true },
    orderBy: { price: "asc" },
  }));

  if (resolved) {
    await cacheSet(ACTIVE_PLAN_CACHE_KEY, resolved, PLAN_CACHE_TTL_SECONDS);
  }

  return resolved;
}

/** Invalidate active plan cache keys when an admin creates, updates, or deletes plans. */
export async function invalidateMembershipPlanCache(): Promise<void> {
  await Promise.allSettled([
    cacheDel(ACTIVE_PLAN_CACHE_KEY),
    cacheDel(ALL_ACTIVE_PLANS_CACHE_KEY),
  ]);
}

export function durationLabel(days: number): string {
  if (days >= 36500) return "Lifetime";
  if (days % 365 === 0) return `${days / 365} year${days / 365 > 1 ? "s" : ""}`;
  if (days % 30 === 0)  return `${days / 30} month${days / 30 > 1 ? "s" : ""}`;
  return `${days} days`;
}
