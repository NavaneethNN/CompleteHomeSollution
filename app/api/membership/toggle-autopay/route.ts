import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleMembershipAutoRenew } from "@/lib/membership";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  autoRenew: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await consumeRateLimit(
      "membership-toggle-autopay",
      `${getClientIp(req.headers)}:${session.user.id}`,
      20,
      10 * 60
    );
    if (!limit.allowed) return rateLimitResponse(limit);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const autoRenew = await toggleMembershipAutoRenew(session.user.id, parsed.data.autoRenew);

    return NextResponse.json({
      success: true,
      autoRenew,
      message: autoRenew ? "Autopay enabled." : "Autopay paused.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update autopay setting";
    if (message.includes("Active VIP membership required")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[POST /api/membership/toggle-autopay] Error:", error);
    return NextResponse.json({ error: "Failed to update autopay setting" }, { status: 500 });
  }
}
