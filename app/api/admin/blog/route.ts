import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendNewBlogPostNotifications } from "@/lib/blog-notifications";

// URL validation helper
function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// GET /api/admin/blog - Get all blog posts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const posts = await db.blogPost.findMany({
      include: {
        author: { select: { id: true, name: true, image: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
        tags: { 
          include: { 
            tag: { select: { id: true, name: true, slug: true, color: true } } 
          } 
        },
        _count: { select: { tags: true } },
      },
      orderBy: [
        { featured: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Blog GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/blog - Create new blog post
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Sanitize and validate inputs
    const sanitizedTitle = title.trim().slice(0, 200);
    const sanitizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 100);
    const sanitizedExcerpt = excerpt ? excerpt.trim().slice(0, 500) : null;
    const sanitizedContent = content.trim().slice(0, 100000); // 100KB limit
    const sanitizedSeoTitle = seoTitle ? seoTitle.trim().slice(0, 60) : null;
    const sanitizedSeoDescription = seoDescription ? seoDescription.trim().slice(0, 160) : null;

    // Validate status
    const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Validate cover image URL
    if (coverImage && !isValidUrl(coverImage)) {
      return NextResponse.json({ error: "Invalid cover image URL" }, { status: 400 });
    }

    // Validate published date
    let validPublishedAt = null;
    if (publishedAt) {
      const date = new Date(publishedAt);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: "Invalid published date" }, { status: 400 });
      }
      validPublishedAt = date;
    }

    // Check if slug is unique
    const existingPost = await db.blogPost.findUnique({
      where: { slug: sanitizedSlug },
    });

    if (existingPost) {
      return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
    }

    // Create the post
    const post = await db.blogPost.create({
      data: {
        title: sanitizedTitle,
        slug: sanitizedSlug,
        excerpt: sanitizedExcerpt,
        content: sanitizedContent,
        coverImage,
        status: status || "DRAFT",
        featured: featured || false,
        isMemberOnly: isMemberOnly || false,
        publishedAt: validPublishedAt,
        authorId: session.user.id,
        categoryId: categoryId || null,
        seoTitle: sanitizedSeoTitle,
        seoDescription: sanitizedSeoDescription,
        tags: tags ? {
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

    // Send email notifications if post is being published
    if (post.status === "PUBLISHED" && post.publishedAt) {
      try {
        await sendNewBlogPostNotifications({
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          author: post.author,
          publishedAt: post.publishedAt,
        });
        console.log("Blog post notifications sent successfully");
      } catch (error) {
        console.error("Failed to send blog post notifications:", error);
        // Don't fail the request if notifications fail
      }
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Blog POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
