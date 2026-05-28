import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse + validate body
    let requestedPlanId: string | undefined;
    try {
      const body = await req.json();
      if (body?.planId && typeof body.planId === "string" && body.planId.length < 100) {
        requestedPlanId = body.planId;
      }
    } catch { /* no body — fine */ }

    // Fetch user + plan in parallel
    const [user, plan] = await Promise.all([
      db.user.findUnique({
        where: { id: session.user.id },
        select: { isMember: true, membershipExpiry: true },
      }),
      requestedPlanId
        ? db.membershipPlan.findFirst({ where: { id: requestedPlanId, isActive: true } })
        : db.membershipPlan.findFirst({ where: { isActive: true, isDefault: true }, orderBy: { createdAt: "asc" } })
            .then((p) => p ?? db.membershipPlan.findFirst({ where: { isActive: true }, orderBy: { price: "asc" } })),
    ]);

    // Auto-revoke expired memberships silently before checkout
    const now = new Date();
    if (user?.isMember && user.membershipExpiry && user.membershipExpiry < now) {
      await db.user.update({
        where: { id: session.user.id },
        data: { isMember: false },
      });
    }

    if (!plan) {
      return NextResponse.json({ error: "No membership plans are currently available" }, { status: 404 });
    }

    const priceCents = Math.round(plan.price * 100);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
    const stripe = getStripe();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: session.user.email,
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: `CHS ${plan.name}`,
              description: plan.description ?? "Unlocks member pricing, free express delivery & more",
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "membership",
        userId: session.user.id,
        planId: plan.id,
      },
      success_url: `${appUrl}/account/membership?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/account/membership?cancelled=1`,
    });

    console.log(`[membership] Checkout initiated — user ${session.user.id}, plan "${plan.name}" ($${plan.price}), session ${checkoutSession.id}`);

    return NextResponse.json({ url: checkoutSession.url, price: plan.price, plan: plan.name });
  } catch (error) {
    console.error("[POST /api/membership/checkout]", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
