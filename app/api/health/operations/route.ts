import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasValidCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const now = new Date();
    const [refundActions, overdueEmailJobs, failedStockAlerts, paymentReviews, fulfillmentReviews] = await Promise.all([
      db.order.count({ where: { refundRequested: true, status: { not: "REFUNDED" } } }),
      db.emailJob.count({ where: { OR: [
        { status: "PENDING", attempts: { gte: 3 }, nextAttemptAt: { lte: now } },
        { status: "PENDING", nextAttemptAt: { lte: new Date(now.getTime() - 15 * 60_000) } },
        { status: "CLAIMED", claimUntil: { lte: now } },
      ] } }),
      db.stockAlert.count({ where: { notifiedAt: null, attempts: { gte: 3 } } }),
      db.order.count({ where: { status: "PENDING", createdAt: { lte: new Date(now.getTime() - 15 * 60_000) } } }),
      db.order.count({ where: { status: { in: ["PAID", "CONFIRMED", "PROCESSING"] }, createdAt: { lte: new Date(now.getTime() - 48 * 60 * 60_000) } } }),
    ]);
    const needsAttention = refundActions + overdueEmailJobs + failedStockAlerts + paymentReviews + fulfillmentReviews > 0;
    return NextResponse.json({ status: needsAttention ? "attention" : "ok", refundActions, overdueEmailJobs, failedStockAlerts, paymentReviews, fulfillmentReviews },
      { status: needsAttention ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
