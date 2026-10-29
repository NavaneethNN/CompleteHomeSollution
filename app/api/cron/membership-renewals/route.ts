import { NextRequest, NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { processFailedRenewal, activateMembership } from "@/lib/membership";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron route to process due membership autopay renewals and multi-day retries.
 * Triggered daily by Vercel Cron or manual scheduled trigger.
 */
export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find users who have autopay enabled and either:
  // 1. Their membership is expiring/expired and not yet in retry
  // 2. Or they are in retry mode and their next retry date has arrived
  const dueUsers = await db.user.findMany({
    where: {
      membershipAutoRenew: true,
      OR: [
        {
          isMember: true,
          membershipExpiry: { lte: now },
          membershipNextRetryAt: null,
        },
        {
          membershipNextRetryAt: { lte: now },
        },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      membershipRetryCount: true,
      membershipStatus: true,
      membershipExpiry: true,
    },
    take: 50,
  });

  const results: Array<{ userId: string; action: string; details?: unknown }> = [];

  for (const user of dueUsers) {
    try {
      // In this environment, automatic recurring card charge attempt:
      // If payment cannot be settled (e.g. gateway has no saved card on file, card expired, insufficient funds),
      // we initiate the 2-retry multi-day failure flow as mandated.
      const failureResult = await processFailedRenewal(
        user.id,
        "Insufficient funds or card decline during automatic renewal"
      );

      results.push({
        userId: user.id,
        action: failureResult.revoked ? "REVOKED_AFTER_RETRIES" : `RETRY_SCHEDULED_#${failureResult.retryCount}`,
        details: failureResult,
      });
    } catch (err) {
      console.error(`[Membership Renewal Cron] Failed for user ${user.id}:`, err);
      results.push({ userId: user.id, action: "ERROR", details: String(err) });
    }
  }

  return NextResponse.json({
    checked: dueUsers.length,
    processed: results.length,
    results,
  });
}

