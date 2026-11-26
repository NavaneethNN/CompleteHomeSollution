import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheFetch, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const rl = await consumeRateLimit("search", getClientIp(req.headers), 60, 60);
  if (!rl.allowed) return rateLimitResponse(rl);

  const q = (req.nextUrl.searchParams.get("q")?.trim() ?? "").slice(0, 100);
  const rawLimit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "12", 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 12, 50);
  const rawPage = Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);

  if (q.length < 2) {
    return NextResponse.json({ products: [], total: 0 });
  }

  const where = {
    isActive: true,
    OR: [
      { name:        { contains: q, mode: "insensitive" as const } },
      { sku:         { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } },
      { category: { name: { contains: q, mode: "insensitive" as const } } },
    ],
  };

  try {
    const cacheKey = CACHE_KEYS.searchSuggest(`${q.toLowerCase()}:${limit}:${page}`);
    const data = await cacheFetch(cacheKey, CACHE_TTL.searchSuggest, async () => {
      const [products, total] = await Promise.all([
        db.product.findMany({
          where,
          select: {
            id:           true,
            name:         true,
            slug:         true,
            images:       true,
            basePrice:    true,
            comparePrice: true,
            memberPrice:  true,
            hasVariants:  true,
            category:     { select: { name: true, slug: true } },
            productVariants: {
              where:   { isActive: true },
              select:  { price: true },
              orderBy: { price: "asc" },
              take:    1,
            },
            _count: { select: { reviews: true } },
          },
          orderBy: { createdAt: "desc" },
          take:    limit,
          skip:    (page - 1) * limit,
        }),
        db.product.count({ where }),
      ]);
      return { products, total, page, limit };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/search]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
