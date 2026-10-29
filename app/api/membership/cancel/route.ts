import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelMembership } from "@/lib/membership";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await consumeRateLimit(
      "membership-cancel",
      `${getClientIp(req.headers)}:${session.user.id}`,
      10,
      15 * 60
    );
    if (!limit.allowed) return rateLimitResponse(limit);

    await cancelMembership(session.user.id);

    return NextResponse.json({
      success: true,
      message: "Membership and autopay have been cancelled immediately.",
    });
  } catch (error) {
    console.error("[POST /api/membership/cancel] Error:", error);
    return NextResponse.json({ error: "Failed to cancel membership" }, { status: 500 });
  }
}

