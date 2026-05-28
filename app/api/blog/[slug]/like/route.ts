import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";

// Simple in-memory rate limiting (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(userId: string, postId: string): string {
  return `like:${userId}:${postId}`;
}

function checkRateLimit(key: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

// POST /api/blog/[slug]/like - Like or unlike a blog post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Check if user is a member
    if (!session.user.isMember) {
      return NextResponse.json({ error: "Membership required to like posts" }, { status: 403 });
    }

    const { slug } = await params;

    // Find the blog post
    const post = await db.blogPost.findUnique({
      where: { slug },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check rate limiting
    const rateLimitKey = getRateLimitKey(session.user.id, post.id);
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    // Check if user already liked this post
    const existingLike = await db.blogLike.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: session.user.id,
        },
      },
    });

    if (existingLike) {
      await db.blogLike.delete({ where: { id: existingLike.id } });
      const updated = await db.blogPost.update({
        where: { id: post.id },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return NextResponse.json({ liked: false, likeCount: Math.max(0, updated.likeCount) });
    } else {
      await db.blogLike.create({ data: { postId: post.id, userId: session.user.id } });
      const updated = await db.blogPost.update({
        where: { id: post.id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return NextResponse.json({ liked: true, likeCount: updated.likeCount });
    }
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

    // Find the blog post
    const post = await db.blogPost.findUnique({
      where: { slug },
      select: {
        id: true,
        likeCount: true,
      },
    });

    if (!post) {
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
