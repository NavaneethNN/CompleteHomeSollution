import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ productId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { productId } = await params;

    const reviews = await db.review.findMany({
      where: { productId },
      include: { user: { select: { name: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
        : 0;

    return NextResponse.json({ data: reviews, avgRating, total: reviews.length });
  } catch (error) {
    console.error("[GET /api/reviews/[productId]]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
