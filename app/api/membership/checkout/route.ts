import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chargeToken, PayWayApiError } from "@/lib/payway";
import { activateMembership } from "@/lib/membership";

const bodySchema = z.object({
  singleUseTokenId: z.string().uuid("Invalid payment token"),
  planId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { singleUseTokenId, planId } = parsed.data;

    const [user, plan] = await Promise.all([
      db.user.findUnique({
        where: { id: session.user.id },
        select: { isMember: true, membershipExpiry: true },
      }),
      planId
        ? db.membershipPlan.findFirst({ where: { id: planId, isActive: true } })
        : db.membershipPlan
            .findFirst({ where: { isActive: true, isDefault: true }, orderBy: { createdAt: "asc" } })
            .then((p) => p ?? db.membershipPlan.findFirst({ where: { isActive: true }, orderBy: { price: "asc" } })),
    ]);

    const now = new Date();
    const isExpired = user?.isMember && user.membershipExpiry && user.membershipExpiry < now;

    // Auto-revoke expired membership silently
    if (isExpired) {
      await db.user.update({
        where: { id: session.user.id },
        data: { isMember: false, memberSince: null, membershipExpiry: null },
      });
    }

    // Block active members (API guard — UI also hides the button)
    if (user?.isMember && !isExpired) {
      return NextResponse.json(
        { error: "You already have an active membership." },
        { status: 409 }
      );
    }

    if (!plan) {
      return NextResponse.json({ error: "No membership plans available" }, { status: 404 });
    }

    const customerIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    // Charge via PayWay
    let txn;
    try {
      txn = await chargeToken({
        singleUseTokenId,
        orderNumber: `MBR-${session.user.id}`,
        principalAmount: plan.price,
        customerIpAddress: customerIp,
      });
    } catch (err) {
      console.error("[membership checkout] PayWay charge failed", err);
      const userMessage =
        err instanceof PayWayApiError
          ? (err.errors[0]?.message ?? err.message)
          : "Payment failed. Please try again.";
      return NextResponse.json({ error: userMessage }, { status: 422 });
    }

    if (txn.status === "declined" || txn.status === "suspended") {
      return NextResponse.json(
        { error: txn.responseText || "Payment declined.", status: "declined" },
        { status: 402 }
      );
    }

    // Activate membership
    await activateMembership({
      userId: session.user.id,
      planId: plan.id,
      paywaySessionId: String(txn.transactionId),
      amountPaid: txn.paymentAmount,
    });

    console.log(
      `[membership] Activated — user ${session.user.id}, plan "${plan.name}", txn ${txn.transactionId}`
    );

    return NextResponse.json({
      status: "success",
      transactionId: txn.transactionId,
      receiptNumber: txn.receiptNumber,
      plan: plan.name,
      price: plan.price,
    });
  } catch (error) {
    console.error("[POST /api/membership/checkout]", error);
    return NextResponse.json({ error: "Failed to process membership payment" }, { status: 500 });
  }
}
