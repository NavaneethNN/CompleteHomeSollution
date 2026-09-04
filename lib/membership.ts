/**
 * lib/membership.ts
 *
 * Single source of truth for all membership activation/revocation logic.
 * All code paths (webhook, page redirect, admin grant) must go through here.
 */

import { db } from "@/lib/db";

export interface ActivateMembershipOptions {
  userId: string;
  /** planId to look up durationDays. Falls back to default active plan. */
  planId?: string | null;
  /** Stripe session ID for idempotency guard — skips if already recorded. */
  paywaySessionId?: string;
  /** Amount paid in AUD for payment record. */
  amountPaid?: number;
}

export interface ActivateMembershipResult {
  activated: boolean;
  alreadyProcessed: boolean;
  expiresAt: Date | null;
}

/**
 * Atomically activates or renews a membership.
 *
 * Safety guarantees:
 * - Idempotent: if paywaySessionId is provided and already recorded, returns
 *   alreadyProcessed=true without writing anything.
 * - Renewal-safe: extends from existing expiry if not yet lapsed, not from today.
 * - Always writes membershipExpiry so expiry enforcement works correctly.
 */
export async function activateMembership(
  opts: ActivateMembershipOptions
): Promise<ActivateMembershipResult> {
  const { userId, planId, paywaySessionId, amountPaid } = opts;

  return db.$transaction(async (tx) => {
    // Idempotency guard: if this Stripe session was already processed, skip.
    if (paywaySessionId) {
      const existing = await tx.membershipPayment.findUnique({
        where: { paywaySessionId },
        select: { id: true },
      });
      if (existing) {
        return { activated: false, alreadyProcessed: true, expiresAt: null };
      }
    }

    // Resolve plan duration
    let durationDays = 365;
    let resolvedPlanId: string | null = planId ?? null;

    if (planId) {
      const plan = await tx.membershipPlan.findUnique({
        where: { id: planId },
        select: { id: true, durationDays: true },
      });
      if (plan) {
        durationDays = plan.durationDays;
        resolvedPlanId = plan.id;
      }
    } else {
      // Fall back to default active plan
      const defaultPlan = await tx.membershipPlan.findFirst({
        where: { isActive: true, isDefault: true },
        select: { id: true, durationDays: true },
        orderBy: { createdAt: "asc" },
      });
      if (defaultPlan) {
        durationDays = defaultPlan.durationDays;
        resolvedPlanId = defaultPlan.id;
      }
    }

    // Fetch current user state
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { isMember: true, memberSince: true, membershipExpiry: true },
    });

    const now = new Date();

    // Renewal: extend from existing expiry if it hasn't lapsed yet
    const baseDate =
      user?.membershipExpiry && user.membershipExpiry > now
        ? user.membershipExpiry
        : now;

    const expiresAt = new Date(baseDate);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // Update user — always set membershipExpiry, preserve original memberSince
    await tx.user.update({
      where: { id: userId },
      data: {
        isMember: true,
        memberSince: user?.isMember && user.memberSince ? user.memberSince : now,
        membershipExpiry: expiresAt,
      },
    });

    // Record payment if provided
    if (paywaySessionId && amountPaid && amountPaid > 0) {
      await tx.membershipPayment.create({
        data: {
          userId,
          planId: resolvedPlanId,
          amount: amountPaid,
          paywaySessionId,
        },
      });
    }

    return { activated: true, alreadyProcessed: false, expiresAt };
  });
}

/**
 * Revokes a membership fully, clearing all membership fields.
 * Used by admin revoke and expiry enforcement.
 */
export async function revokeMembership(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      isMember: false,
      memberSince: null,
      membershipExpiry: null,
    },
  });
}

/**
 * Grants a membership without a Stripe payment (admin grant).
 * Uses the default plan duration, or 365 days if no plan exists.
 */
export async function grantMembership(
  userId: string,
  durationDays?: number
): Promise<Date> {
  let days = durationDays ?? 365;

  if (!durationDays) {
    const defaultPlan = await db.membershipPlan.findFirst({
      where: { isActive: true, isDefault: true },
      select: { durationDays: true },
      orderBy: { createdAt: "asc" },
    });
    if (defaultPlan) days = defaultPlan.durationDays;
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + days);

  await db.user.update({
    where: { id: userId },
    data: {
      isMember: true,
      memberSince: now,
      membershipExpiry: expiresAt,
    },
  });

  return expiresAt;
}

/**
 * Checks if a user's membership has expired and revokes it if so.
 * Returns true if the membership was revoked.
 * Call this on any auth-protected page that cares about membership status.
 */
export async function enforceExpiry(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isMember: true, membershipExpiry: true },
  });

  if (!user?.isMember) return false;

  // Memberships with no expiry (legacy admin grants before fix) are still valid
  if (!user.membershipExpiry) return false;

  if (user.membershipExpiry < new Date()) {
    await revokeMembership(userId);
    return true;
  }

  return false;
}
