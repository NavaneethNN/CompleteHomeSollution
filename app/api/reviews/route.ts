import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";

const createReviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  images: z.array(z.string().url()).max(5).optional().default([]),
});

// GET /api/reviews?productId=xxx — returns eligibility for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const productId = req.nextUrl.searchParams.get("productId");
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    if (!session?.user?.id) {
      return NextResponse.json({ loggedIn: false, hasPurchased: false, existingReview: null });
    }

    const userId = session.user.id;

    // Check if user has a PAID/DELIVERED/SHIPPED order containing this product
    const purchase = await db.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] },
        },
      },
      select: { id: true },
    });

    const existingReview = await db.review.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true, rating: true, comment: true, images: true },
    });

    return NextResponse.json({ loggedIn: true, hasPurchased: !!purchase, existingReview });
  } catch (error) {
    console.error("[GET /api/reviews]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Login required to leave a review" }, { status: 401 });
    }

    const body = await req.json();
    const data = createReviewSchema.parse(body);
    const userId = session.user.id;

    // Verify purchase before allowing review
    const purchase = await db.orderItem.findFirst({
      where: {
        productId: data.productId,
        order: {
          userId,
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] },
        },
      },
      select: { id: true },
    });

    if (!purchase) {
      return NextResponse.json(
        { error: "You can only review products you have purchased." },
        { status: 403 }
      );
    }

    const review = await db.review.upsert({
      where: { userId_productId: { userId, productId: data.productId } },
      create: { userId, productId: data.productId, rating: data.rating, comment: data.comment, images: data.images },
      update: { rating: data.rating, comment: data.comment, images: data.images },
      include: { user: { select: { name: true, image: true } } },
    });

    return NextResponse.json({ data: review }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/reviews]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
