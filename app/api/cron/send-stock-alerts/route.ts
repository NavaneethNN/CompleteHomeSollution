import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/brevo";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { siteOrigin } from "@/lib/site-indexing";
import { renderStandardEmail, renderCard, escapeHtml } from "@/lib/email-template";

export const runtime = "nodejs";
export const maxDuration = 60;

type DueAlert = { id: string; email: string; name: string; slug: string };

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
      const safeProductName = escapeHtml(alert.name);
      const bodyHtml = `
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
          Good news! An item from your wishlist, <strong>${safeProductName}</strong>, is back in stock and ready to order.
        </p>

        ${renderCard(`
          <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b;">${safeProductName}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#16a34a;font-weight:600;">In Stock & Ready for Dispatch / Showroom Pickup</p>
        `, { title: "Item Availability", bg: "#f0fdf4", border: "#bbf7d0" })}

        <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
          Stock quantities are limited and reserved on a first-come, first-served basis. Order today to secure yours!
        </p>
      `;

      const htmlContent = renderStandardEmail({
        title: `${alert.name} is back in stock`,
        badge: { text: "Back in Stock", type: "success" },
        greeting: "Hello,",
        bodyHtml,
        cta: { text: "View Product & Order Now", url: productUrl },
      });

      await sendEmail({
        to: [{ email: alert.email }],
        subject: `${alert.name} is back in stock — Complete Home Sollution`,
        htmlContent,
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
