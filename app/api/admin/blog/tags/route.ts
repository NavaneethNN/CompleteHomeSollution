import { NextResponse } from "next/server";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import slugify from "slugify";

// GET /api/admin/blog/tags - List all blog tags
export async function GET() {
  if (!(await hasFreshAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tags = await db.blogTag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { posts: true } },
      },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("[GET /api/admin/blog/tags]", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

// POST /api/admin/blog/tags - Create a new blog tag
export async function POST(req: Request) {
  if (!(await hasFreshAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, color } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    // Generate slug from name
    const baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (await db.blogTag.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const tag = await db.blogTag.create({
      data: {
        name: name.trim(),
        slug,
        color: color || "#6366f1",
      },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/blog/tags]", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
