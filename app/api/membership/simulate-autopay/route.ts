import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { processFailedRenewal, activateMembership } from "@/lib/membership";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["simulate_failure", "simulate_success"]),
  userId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { action, userId: targetId } = parsed.data;
    // Allow admins to target any user; non-admins target themselves
    const effectiveUserId = (session.user.role === "ADMIN" && targetId) ? targetId : session.user.id;

    if (action === "simulate_failure") {
      const result = await processFailedRenewal(
        effectiveUserId,
        "Simulated insufficient funds decline"
      );

      const updatedUser = await db.user.findUnique({
        where: { id: effectiveUserId },
        select: {
          isMember: true,
          membershipAutoRenew: true,
          membershipStatus: true,
          membershipCancelReason: true,
          membershipRetryCount: true,
          membershipNextRetryAt: true,
          membershipCancelledAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        action: "simulate_failure",
        result,
        user: updatedUser,
      });
    }

    if (action === "simulate_success") {
      const result = await activateMembership({
        userId: effectiveUserId,
        durationDays: 365,
        amountPaid: 30,
        paywaySessionId: `simulate:${Date.now()}`,
      });

      const updatedUser = await db.user.findUnique({
        where: { id: effectiveUserId },
        select: {
          isMember: true,
          membershipAutoRenew: true,
          membershipStatus: true,
          membershipExpiry: true,
          membershipRetryCount: true,
        },
      });

      return NextResponse.json({
        success: true,
        action: "simulate_success",
        result,
        user: updatedUser,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/membership/simulate-autopay] Error:", error);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}

