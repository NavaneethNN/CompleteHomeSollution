/**
 * lib/membership.ts
 *
 * Single source of truth for all membership activation/revocation logic.
 * All code paths (webhook, page redirect, admin grant) must go through here.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  sendMembershipCancelledEmail,
  sendMembershipPaymentRetryEmail,
  sendMembershipRevokedFailureEmail,
} from "./membership-notifications";

export type MembershipState = {
  isMember: boolean;
  membershipExpiry: Date | null;
};

/** A legacy membership with no expiry remains valid. An expiry is active only
 * while it is strictly in the future, so every storefront uses one boundary. */
export function hasActiveMembership(
  membership: MembershipState | null | undefined,
  now = new Date()
): boolean {
  return !!membership?.isMember &&
    (!membership.membershipExpiry || membership.membershipExpiry > now);
}

export interface ActivateMembershipOptions {
  userId: string;
  durationDays?: number;
  /** planId to look up durationDays. Falls back to default active plan. */
  planId?: string | null;
  /** Payment session ID for idempotency guard — skips if already recorded. */
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
  return db.$transaction((tx) => activateMembershipInTransaction(tx, opts));
}

export async function activateMembershipInTransaction(
  tx: Prisma.TransactionClient, opts: ActivateMembershipOptions
): Promise<ActivateMembershipResult> {
  const { userId, planId, paywaySessionId, amountPaid } = opts;
  // Serialize activations for this user, including distinct simultaneous payments.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  // Idempotency guard: if this Payment session was already processed, skip.
  if (paywaySessionId) {
    const existing = await tx.membershipPayment.findFirst({
      where: { OR: [{ paywaySessionId }, { stripeSessionId: paywaySessionId }] },
      select: { id: true },
    });
    if (existing) {
      return { activated: false, alreadyProcessed: true, expiresAt: null };
    }
  }

  // Resolve plan duration
  let durationDays = 365;
  let resolvedPlanId: string | null = null;

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

  if (opts.durationDays !== undefined) durationDays = opts.durationDays;
  if (!Number.isInteger(durationDays) || durationDays <= 0) throw new Error("Invalid membership duration");
  const now = new Date();

  // Renewal: extend from existing expiry if it hasn't lapsed yet
  const baseDate =
    user?.isMember && user.membershipExpiry && user.membershipExpiry > now
      ? user.membershipExpiry
      : now;

  const expiresAt = new Date(baseDate);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + durationDays);

  // Update user — always set membershipExpiry, preserve original memberSince
  await tx.user.update({
    where: { id: userId },
    data: {
      isMember: true,
      memberSince: user?.isMember && user.memberSince ? user.memberSince : now,
      membershipExpiry: expiresAt,
      membershipAutoRenew: true,
      membershipStatus: "ACTIVE",
      membershipRetryCount: 0,
      membershipNextRetryAt: null,
      membershipCancelReason: null,
      membershipCancelledAt: null,
    },
  });

  // Record payment if provided
  if (paywaySessionId) {
    if (!Number.isFinite(amountPaid) || amountPaid! < 0) throw new Error("Invalid membership amount");
    await tx.membershipPayment.create({
      data: {
        userId,
        planId: resolvedPlanId,
        amount: amountPaid!,
        expiresAt,
        previousExpiry: user?.isMember ? user.membershipExpiry : null,
        paywaySessionId,
      },
    });
  }

  return { activated: true, alreadyProcessed: false, expiresAt };
}

/**
 * Cancels a membership manually by customer:
 * Revokes autopay and revokes membership immediately.
 */
export async function cancelMembership(userId: string, reason = "Cancelled manually by customer"): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isMember: true },
  });
  if (!user) throw new Error("User not found");

  await db.user.update({
    where: { id: userId },
    data: {
      isMember: false,
      membershipAutoRenew: false,
      membershipStatus: "CANCELLED",
      membershipCancelReason: reason,
      membershipCancelledAt: new Date(),
      membershipExpiry: null,
      membershipNextRetryAt: null,
      membershipRetryCount: 0,
    },
  });

  if (user.email) {
    await sendMembershipCancelledEmail(user.email, user.name || "Customer").catch((err) => {
      console.error("[Membership] Cancellation email error:", err);
    });
  }
}

/**
 * Toggles autopay on/off for a user without modifying their active membership period.
 */
export async function toggleMembershipAutoRenew(userId: string, autoRenew: boolean): Promise<boolean> {
  const user = await db.user.update({
    where: { id: userId },
    data: { membershipAutoRenew: autoRenew },
    select: { membershipAutoRenew: true },
  });
  return user.membershipAutoRenew;
}

/**
 * Handles a failed autopay renewal attempt:
 * - Attempts 1 & 2: Schedules retry on a different day (24h later) and sends warning email.
 * - Attempt 3 (after 2 failed retries on different days): Revokes the membership immediately
 *   stating "payment method failure issue".
 */
export async function processFailedRenewal(
  userId: string,
  failureReason = "Insufficient funds / payment method declined"
): Promise<{
  revoked: boolean;
  retryCount: number;
  nextRetryAt?: Date | null;
  message: string;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, membershipRetryCount: true, isMember: true },
  });
  if (!user) throw new Error("User not found");

  const currentRetries = user.membershipRetryCount || 0;

  if (currentRetries < 2) {
    const newRetryCount = currentRetries + 1;
    // Schedule on a different day (24 hours later)
    const nextRetry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.user.update({
      where: { id: userId },
      data: {
        membershipRetryCount: newRetryCount,
        membershipNextRetryAt: nextRetry,
        membershipLastRetryAt: new Date(),
        membershipStatus: "PAYMENT_RETRYING",
        membershipCancelReason: `Payment attempt ${newRetryCount} failed: ${failureReason}`,
      },
    });

    if (user.email) {
      await sendMembershipPaymentRetryEmail(user.email, user.name || "Customer", newRetryCount, nextRetry).catch((err) => {
        console.error("[Membership] Retry notification error:", err);
      });
    }

    return {
      revoked: false,
      retryCount: newRetryCount,
      nextRetryAt: nextRetry,
      message: `Renewal attempt ${newRetryCount} failed. Scheduled retry on a different day (${nextRetry.toISOString()}).`,
    };
  } else {
    // 2 retries already attempted on different days! Revoke immediately.
    const finalReason = "Payment method failure issue (insufficient funds/declined after 2 retry attempts on different days)";

    await db.user.update({
      where: { id: userId },
      data: {
        isMember: false,
        membershipAutoRenew: false,
        membershipStatus: "REVOKED_PAYMENT_FAILURE",
        membershipCancelReason: finalReason,
        membershipCancelledAt: new Date(),
        membershipExpiry: null,
        membershipNextRetryAt: null,
        membershipRetryCount: currentRetries + 1,
      },
    });

    if (user.email) {
      await sendMembershipRevokedFailureEmail(user.email, user.name || "Customer", finalReason).catch((err) => {
        console.error("[Membership] Revocation notification error:", err);
      });
    }

    return {
      revoked: true,
      retryCount: currentRetries + 1,
      message: `Membership revoked immediately stating: ${finalReason}`,
    };
  }
}

/**
 * Revokes a membership fully, clearing all membership fields.
 * Used by admin revoke and expiry enforcement.
 */
export async function revokeMembership(userId: string, reason?: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      isMember: false,
      membershipAutoRenew: false,
      membershipStatus: reason ? "REVOKED" : null,
      membershipCancelReason: reason || null,
      membershipCancelledAt: new Date(),
      memberSince: null,
      membershipExpiry: null,
    },
  });
}

/** Mark a paid membership as expired while retaining its expiry date. Keeping
 * this audit value lets the account and checkout surfaces offer a renewal to a
 * lapsed member instead of treating them as someone who never joined. */
export async function expireMembership(userId: string): Promise<void> {
  await db.user.updateMany({
    where: { id: userId, isMember: true, membershipExpiry: { lte: new Date() } },
    data: { isMember: false },
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
  const result = await activateMembership({ userId, durationDays });
  return result.expiresAt!;
}

/**
 * Checks if a user's membership has expired and revokes it if so.
 * Returns true if the membership was revoked.
 * Call this on any auth-protected page that cares about membership status.
 */
export async function enforceExpiry(userId: string): Promise<boolean> {
  const result = await db.user.updateMany({
    where: { id: userId, isMember: true, membershipExpiry: { lte: new Date() } },
    data: { isMember: false },
  });
  return result.count > 0;
}

/** Remove this purchase's membership time, preserving later paid time and
 * administrator grants. Follow exact expiry links between paid renewals. */
export async function refundOrderMembership(tx: Prisma.TransactionClient, orderId: string) {
  const key = `order:${orderId}:membership`;
  const original = await tx.membershipPayment.findUnique({ where: { paywaySessionId: key } });
  if (!original) return;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${original.userId} FOR UPDATE`;
  const payment = await tx.membershipPayment.findUnique({ where: { paywaySessionId: key } });
  if (!payment || payment.refundedAt) return;
  let oldExpiry = payment.expiresAt;
  let newExpiry = payment.previousExpiry;
  if (oldExpiry) {
    const later = await tx.membershipPayment.findMany({
      where: { userId: payment.userId, refundedAt: null, createdAt: { gte: payment.createdAt }, id: { not: payment.id } },
      orderBy: { createdAt: "asc" },
    });
    for (const renewal of later) {
      if (!renewal.expiresAt || renewal.previousExpiry?.getTime() !== oldExpiry.getTime()) continue;
      // A renewal after the earlier membership expired is independent of it.
      if (renewal.previousExpiry <= renewal.createdAt) break;
      const paidDuration = renewal.expiresAt.getTime() - renewal.previousExpiry.getTime();
      const adjusted = new Date(Math.max(renewal.createdAt.getTime(), newExpiry?.getTime() ?? 0) + paidDuration);
      await tx.membershipPayment.update({ where: { id: renewal.id }, data: { previousExpiry: newExpiry, expiresAt: adjusted } });
      oldExpiry = renewal.expiresAt;
      newExpiry = adjusted;
    }
    await tx.user.updateMany({
      where: { id: payment.userId, membershipExpiry: oldExpiry },
      data: { isMember: !!newExpiry && newExpiry > new Date(), membershipExpiry: newExpiry },
    });
  }
  await tx.membershipPayment.update({ where: { id: payment.id }, data: { refundedAt: new Date() } });
}
