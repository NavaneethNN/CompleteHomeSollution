import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  image: z.string().url().optional(),
});

export async function GET() {
  try {
    const categories = await db.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("[GET /api/categories]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createCategorySchema.parse(body);
    const category = await db.category.create({ data });
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/categories]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
