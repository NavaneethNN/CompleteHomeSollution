import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSimilarProducts, getRecommendationsForUser } from "@/lib/ai";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  productId: z.string().cuid().optional(),
  type: z.enum(["similar", "user", "bought-together"]).default("similar"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const identifier = session?.user?.id ?? getClientIp(req.headers);
    const limit = await consumeRateLimit("recommendations", identifier, 30, 60);
    if (!limit.allowed) return rateLimitResponse(limit);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { productId, type } = parsed.data;

    if (type === "similar" && productId) {
      const products = await getSimilarProducts(productId);
      return NextResponse.json({ data: products });
    }

    if (type === "user" && session?.user?.id) {
      const products = await getRecommendationsForUser(session.user.id);
      return NextResponse.json({ data: products });
    }

    return NextResponse.json({ data: [] });
  } catch (error) {
    console.error("[POST /api/recommendations]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
