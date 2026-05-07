import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const data = updateStatusSchema.parse(body);

    const order = await db.order.update({
      where: { id },
      data,
    });

    return NextResponse.json({ data: order });
  } catch (error) {
    console.error("[PUT /api/orders/[id]/status]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
