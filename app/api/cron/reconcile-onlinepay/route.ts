import { NextRequest, NextResponse } from "next/server";
import { GET as pollPayment } from "@/app/api/orders/[id]/poll-payment/route";
import { db } from "@/lib/db";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { reconciliationDelayMinutes } from "@/lib/reconciliation";

export const runtime = "nodejs";
const CONCURRENCY = 5;

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const secret = process.env.ONLINEPAY_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "ONLINEPAY_WEBHOOK_SECRET is not configured" }, { status: 500 });

  const now = new Date();
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 20));
  const candidates = await db.order.findMany({
    where: {
      status: "PENDING",
      paywayTransactionId: { startsWith: "ONLINEPAY:" },
      reconciliationNextAt: { lte: now },
    },
    orderBy: [{ reconciliationNextAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, reconciliationAttempts: true },
  });
  const missingProviderIds = await db.order.count({
    where: { status: "PENDING", paywayTransactionId: null, createdAt: { lte: new Date(now.getTime() - 15 * 60_000) } },
  });

  const results: Array<{ orderId: string; status: number }> = [];
  for (let offset = 0; offset < candidates.length; offset += CONCURRENCY) {
    const batch = candidates.slice(offset, offset + CONCURRENCY);
    const completed = await Promise.all(batch.map(async candidate => {
      const claimed = await db.order.updateMany({
        where: {
          id: candidate.id,
          status: "PENDING",
          reconciliationNextAt: { lte: now },
        },
        data: {
          reconciliationLastAt: now,
          reconciliationNextAt: new Date(now.getTime() + 5 * 60_000),
          reconciliationAttempts: { increment: 1 },
        },
      });
      if (!claimed.count) return null;
      const internal = new NextRequest(`http://localhost/api/orders/${candidate.id}/poll-payment`, {
        headers: { "x-onlinepay-webhook-secret": secret },
      });
      let response: Response;
      try {
        response = await pollPayment(internal, { params: Promise.resolve({ id: candidate.id }) });
      } catch (error) {
        console.error("[reconcile-onlinepay] poll failed", { orderId: candidate.id, error });
        response = NextResponse.json({ error: "Poll failed" }, { status: 500 });
      }
      const retry = response.status === 202 || response.status >= 500;
      await db.order.updateMany({
        where: { id: candidate.id, status: "PENDING" },
        data: retry ? {
          reconciliationNextAt: new Date(now.getTime() + reconciliationDelayMinutes(candidate.reconciliationAttempts + 1) * 60_000),
          reconciliationError: response.status >= 500 ? `HTTP ${response.status}` : null,
        } : { reconciliationNextAt: null, reconciliationError: null },
      });
      return { orderId: candidate.id, status: response.status };
    }));
    results.push(...completed.filter((result): result is { orderId: string; status: number } => result !== null));
  }
  return NextResponse.json({ checked: results.length, missingProviderIds, results });
}
