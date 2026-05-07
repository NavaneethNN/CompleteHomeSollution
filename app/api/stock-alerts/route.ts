import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  productId: z.string().cuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, productId } = schema.parse(body);

    await db.stockAlert.upsert({
      where: { email_productId: { email, productId } },
      create: { email, productId },
      update: {},
    });

    return NextResponse.json({ message: "You'll be notified when this item is back in stock." });
  } catch (error) {
    console.error("[POST /api/stock-alerts]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
