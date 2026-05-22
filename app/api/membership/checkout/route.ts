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

    // Optional planId from request body
    let requestedPlanId: string | undefined;
    try {
      const body = await req.json();
      requestedPlanId = body?.planId;
    } catch { /* no body is fine */ }

    // Fetch user + requested (or default) plan in parallel
    const [user, plan] = await Promise.all([
      db.user.findUnique({ where: { id: session.user.id }, select: { isMember: true } }),
      requestedPlanId
        ? db.membershipPlan.findFirst({ where: { id: requestedPlanId, isActive: true } })
        : db.membershipPlan.findFirst({ where: { isActive: true, isDefault: true }, orderBy: { createdAt: "asc" } })
            .then((p) => p ?? db.membershipPlan.findFirst({ where: { isActive: true }, orderBy: { price: "asc" } })),
    ]);

    if (user?.isMember) {
      return NextResponse.json({ error: "You are already a member" }, { status: 400 });
    }

    if (!plan) {
      return NextResponse.json({ error: "No membership plans are currently available" }, { status: 404 });
    }

    const priceCents = Math.round(plan.price * 100);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
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
