import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendNewBlogPostNotifications } from "@/lib/blog-notifications";

// PUT /api/admin/blog/[id] - Update blog post
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      slug,
      excerpt,
      content,
      coverImage,
      status,
      featured,
      isMemberOnly,
      publishedAt,
      categoryId,
      seoTitle,
      seoDescription,
      tags,
    } = body;

    // Validate required fields
    if (!title || !slug || !content) {
      return NextResponse.json({ error: "Title, slug, and content are required" }, { status: 400 });
    }

    // Check if post exists
    const existingPost = await db.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if slug is unique (if changed)
    if (slug !== existingPost.slug) {
      const slugExists = await db.blogPost.findUnique({
        where: { slug },
      });

      if (slugExists) {
        return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
      }
    }

    // Update the post
    const post = await db.blogPost.update({
      where: { id },
      data: {
        title,
        slug,
        excerpt,
        content,
        coverImage,
        status: status || "DRAFT",
        featured: featured || false,
        isMemberOnly: isMemberOnly || false,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        categoryId: categoryId || null,
        seoTitle,
        seoDescription,
        tags: tags ? {
          deleteMany: {},
          create: tags.map((tag: { tagId: string }) => ({
            tag: { connect: { id: tag.tagId } },
          })),
        } : undefined,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
        tags: { 
          include: { 
            tag: { select: { id: true, name: true, slug: true, color: true } } 
          } 
        },
      },
    });

    // Send email notifications if post is being published for the first time
    const wasAlreadyPublished = existingPost.status === "PUBLISHED";
    if (post.status === "PUBLISHED" && !wasAlreadyPublished && post.publishedAt) {
      sendNewBlogPostNotifications({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        author: post.author,
        publishedAt: post.publishedAt,
      }).catch((e) => console.error("[blog PUT] notification failed:", e));
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("Blog PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/blog/[id] - Delete blog post
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if post exists
    const existingPost = await db.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Delete the post (cascade will handle tags)
    await db.blogPost.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Blog DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
