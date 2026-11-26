import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { createProductSchema, productFiltersSchema } from "@/lib/validations/product";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const filters = productFiltersSchema.parse({
      category: searchParams.get("category") ?? undefined,
      minPrice: searchParams.get("minPrice") ?? undefined,
      maxPrice: searchParams.get("maxPrice") ?? undefined,
      material: searchParams.get("material") ?? undefined,
      roomType: searchParams.get("roomType") ?? undefined,
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
      sort: searchParams.get("sort") ?? "newest",
    });

    const skip = (filters.page - 1) * filters.limit;

    const orderBy = {
      newest: { createdAt: "desc" as const },
      price_asc: { basePrice: "asc" as const },
      price_desc: { basePrice: "desc" as const },
      popular: { createdAt: "desc" as const },
    }[filters.sort];

    const where = {
      isActive: true,
      ...(filters.category && { category: { slug: filters.category } }),
      ...(filters.material && { material: filters.material }),
      ...(filters.roomType && { roomType: filters.roomType }),
      ...((filters.minPrice !== undefined || filters.maxPrice !== undefined) && {
        basePrice: {
          ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
          ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
        },
      }),
    };

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy,
        skip,
        take: filters.limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      data: products,
      total,
      page: filters.page,
      limit: filters.limit,
      hasNext: skip + filters.limit < total,
    });
  } catch (error) {
    console.error("[GET /api/products]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await hasFreshAdminSession())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createProductSchema.parse(body);

    const product = await db.product.create({ data });
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/products]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
