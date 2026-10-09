import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email().max(254),
  productId: z.string().cuid(),
}).strict();

export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const { email, productId } = schema.parse(body);
    const limit = await consumeRateLimit("stock-alert", `${getClientIp(req.headers)}:${email}`, 10, 60 * 60);
    if (!limit.allowed) return rateLimitResponse(limit);

    const product = await db.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true, hasVariants: true, stock: true, productVariants: { where: { isActive: true, stock: { gt: 0 } }, select: { id: true }, take: 1 } } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (product.hasVariants ? product.productVariants.length > 0 : product.stock > 0) return NextResponse.json({ error: "This product is already in stock" }, { status: 409 });
    await db.stockAlert.upsert({
      where: { email_productId: { email, productId } },
      create: { email, productId },
      update: { notifiedAt: null, nextAttemptAt: new Date(), claimUntil: null, attempts: 0, lastError: null },
    });

    return NextResponse.json({ message: "You'll be notified when this item is back in stock." });
  } catch (error) {
    console.error("[POST /api/stock-alerts]", error);
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
