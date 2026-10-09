import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasValidCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = Date.now();
  // Exclude already-queued reviews before limiting the batch. Otherwise the
  // same oldest 50 unresolved orders starve every later order indefinitely.
  const [paymentReview, fulfillmentReview] = await Promise.all([
    db.$queryRaw<Array<{ id: string }>>`
      SELECT o.id FROM "Order" o
      WHERE o.status = 'PENDING' AND o."createdAt" <= ${new Date(now - 15 * 60_000)}
        AND NOT EXISTS (SELECT 1 FROM "EmailJob" j WHERE j.key = 'order:' || o.id || ':payment-review')
      ORDER BY o."createdAt", o.id LIMIT 50
    `,
    db.$queryRaw<Array<{ id: string }>>`
      SELECT o.id FROM "Order" o
      WHERE o.status IN ('PAID', 'CONFIRMED', 'PROCESSING') AND o."createdAt" <= ${new Date(now - 48 * 60 * 60_000)}
        AND NOT EXISTS (SELECT 1 FROM "EmailJob" j WHERE j.key = 'order:' || o.id || ':fulfillment-review')
      ORDER BY o."createdAt", o.id LIMIT 50
    `,
  ]);
  const jobs = [
    ...paymentReview.map(order => ({ key: `order:${order.id}:payment-review`, kind: "PAYMENT_REVIEW", orderId: order.id })),
    ...fulfillmentReview.map(order => ({ key: `order:${order.id}:fulfillment-review`, kind: "FULFILLMENT_REVIEW", orderId: order.id })),
  ];
  if (jobs.length) await db.emailJob.createMany({ data: jobs, skipDuplicates: true });
  return NextResponse.json({ paymentReview: paymentReview.length, fulfillmentReview: fulfillmentReview.length, jobsChecked: jobs.length });
}
