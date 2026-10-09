import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/brevo";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { siteOrigin } from "@/lib/site-indexing";

export const runtime = "nodejs";
export const maxDuration = 60;

type DueAlert = { id: string; email: string; name: string; slug: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const deadline = Date.now() + 40_000;
  const due = await db.$queryRaw<DueAlert[]>`
    SELECT a.id, a.email, p.name, p.slug
    FROM "StockAlert" a JOIN "Product" p ON p.id = a."productId"
    WHERE a."notifiedAt" IS NULL AND a."nextAttemptAt" <= ${now}
      AND (a."claimUntil" IS NULL OR a."claimUntil" <= ${now})
      AND p."isActive" = true
      AND ((p."hasVariants" = false AND p.stock > 0) OR (p."hasVariants" = true AND EXISTS (
        SELECT 1 FROM "ProductVariant" v
        WHERE v."productId" = p.id AND v."isActive" = true AND v.stock > 0
      )))
    ORDER BY a."nextAttemptAt", a."createdAt"
    LIMIT 25
  `;
  let sent = 0;
  let failed = 0;
  for (const alert of due) {
    if (Date.now() >= deadline) break;
    const claimUntil = new Date(Date.now() + 5 * 60_000);
    const claimed = await db.stockAlert.updateMany({
      where: { id: alert.id, notifiedAt: null, nextAttemptAt: { lte: now }, OR: [{ claimUntil: null }, { claimUntil: { lte: now } }] },
      data: { claimUntil, attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const productUrl = `${siteOrigin()}/products/${encodeURIComponent(alert.slug)}`;
      await sendEmail({
        to: [{ email: alert.email }],
        subject: `${alert.name} is back in stock`,
        htmlContent: `<p>${escapeHtml(alert.name)} is available again.</p><p><a href="${productUrl}">View product</a></p>`,
        textContent: `${alert.name} is available again: ${productUrl}`,
        headers: { idempotencyKey: alert.id },
      });
      await db.stockAlert.updateMany({ where: { id: alert.id, notifiedAt: null, claimUntil }, data: { notifiedAt: new Date(), claimUntil: null, lastError: null } });
      sent++;
    } catch {
      const current = await db.stockAlert.findUnique({ where: { id: alert.id }, select: { attempts: true } });
      const delayMinutes = Math.min(60, 2 ** Math.min(current?.attempts ?? 1, 6));
      await db.stockAlert.updateMany({ where: { id: alert.id, notifiedAt: null, claimUntil }, data: { claimUntil: null, nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000), lastError: "Delivery failed" } });
      failed++;
    }
  }
  return NextResponse.json({ checked: due.length, sent, failed });
}
