import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: {
        // S-5: Only expose required product fields — not the full product object
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: true,
                sku: true,
                basePrice: true,
              },
            },
            productVariant: {
              select: {
                id: true,
                sku: true,
                price: true,
                images: { select: { url: true, displayOrder: true } },
                values: {
                  include: {
                    variantValue: {
                      select: {
                        value: true,
                        variantAttribute: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        address: true,
      },
    });

    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: order });
  } catch (error) {
    console.error("[GET /api/orders/[id]]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
