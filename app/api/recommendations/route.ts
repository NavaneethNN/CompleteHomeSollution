import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSimilarProducts, getRecommendationsForUser } from "@/lib/ai";
import { z } from "zod";

const schema = z.object({
  productId: z.string().optional(),
  type: z.enum(["similar", "user", "bought-together"]).default("similar"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { productId, type } = schema.parse(body);

    if (type === "similar" && productId) {
      const products = await getSimilarProducts(productId);
      return NextResponse.json({ data: products });
    }

    if (type === "user" && session?.user.id) {
      const products = await getRecommendationsForUser(session.user.id);
      return NextResponse.json({ data: products });
    }

    return NextResponse.json({ data: [] });
  } catch (error) {
    console.error("[POST /api/recommendations]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
