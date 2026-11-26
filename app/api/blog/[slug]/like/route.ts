import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasActiveMembership } from "@/lib/membership";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// POST /api/blog/[slug]/like - Like or unlike a blog post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isMember: true, membershipExpiry: true },
    });
    if (!hasActiveMembership(dbUser)) {
      return NextResponse.json({ error: "Membership required to like posts" }, { status: 403 });
    }

    const { slug } = await params;

    // Find the published blog post
    const post = await db.blogPost.findUnique({
      where: { slug },
      select: { id: true, isPublished: true },
    });

    if (!post || !post.isPublished) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const limit = await consumeRateLimit(
      "blog-like",
      `${getClientIp(request.headers)}:${session.user.id}:${post.id}`,
      10,
      60
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const result = await db.$transaction(async (tx) => {
      const existingLike = await tx.blogLike.findUnique({
        where: {
          postId_userId: {
            postId: post.id,
            userId: session.user.id,
          },
        },
      });

      if (existingLike) {
        await tx.blogLike.delete({ where: { id: existingLike.id } });
        const updated = await tx.blogPost.update({
          where: { id: post.id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: Math.max(0, updated.likeCount) };
      }

      await tx.blogLike.create({ data: { postId: post.id, userId: session.user.id } });
      const updated = await tx.blogPost.update({
        where: { id: post.id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: updated.likeCount };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Blog like error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/blog/[slug]/like - Get like status and count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    const { slug } = await params;

    // Find the published blog post
    const post = await db.blogPost.findUnique({
      where: { slug },
      select: {
        id: true,
        isPublished: true,
        likeCount: true,
      },
    });

    if (!post || !post.isPublished) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    let userLiked = false;
    if (session?.user) {
      const userLike = await db.blogLike.findUnique({
        where: {
          postId_userId: {
            postId: post.id,
            userId: session.user.id,
          },
        },
      });
      userLiked = !!userLike;
    }

    return NextResponse.json({
      likeCount: post.likeCount,
      userLiked,
    });
  } catch (error) {
    console.error("Blog like GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
