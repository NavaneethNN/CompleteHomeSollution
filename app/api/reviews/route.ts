import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";

const createReviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Login required to leave a review" }, { status: 401 });

    const body = await req.json();
    const data = createReviewSchema.parse(body);

    const review = await db.review.upsert({
      where: { userId_productId: { userId: session.user.id, productId: data.productId } },
      create: { userId: session.user.id, ...data },
      update: { rating: data.rating, comment: data.comment },
    });

    return NextResponse.json({ data: review }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/reviews]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
