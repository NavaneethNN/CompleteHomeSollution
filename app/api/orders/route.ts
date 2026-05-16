import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { createOrderSchema } from "@/lib/validations/order";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const where =
      session.user.role === "ADMIN" ? {} : { userId: session.user.id };

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    if (status) Object.assign(where, { status });

    const orders = await db.order.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true, images: true } } } },
        address: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: orders });
  } catch (error) {
    console.error("[GET /api/orders]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const input = createOrderSchema.parse(body);

    const products = await db.product.findMany({
      where: { id: { in: input.items.map((i) => i.productId) } },
    });

    let subtotal = 0;
    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 400 });
      }
      const price =
        session?.user.isMember && product.memberPrice
          ? product.memberPrice
          : product.basePrice;
      subtotal += price * item.quantity;
    }

    const address = await db.address.create({
      data: {
        ...(session && { userId: session.user.id }),
        name: input.address.name,
        phone: input.address.phone,
        line1: input.address.line1,
        line2: input.address.line2 || null,
        suburb: input.address.suburb,
        state: input.address.state,
        postcode: input.address.postcode,
        country: input.address.country || "AU",
      },
    });

    const TAX_RATE = 0.1;
    const shippingCost = 15;
    const tax = subtotal * TAX_RATE;
    const total = subtotal + shippingCost + tax;

    const order = await db.order.create({
      data: {
        ...(session && { userId: session.user.id }),
        guestEmail: input.guestInfo?.email,
        guestPhone: input.guestInfo?.phone,
        addressId: address.id,
        subtotal,
        shippingCost,
        tax,
        total,
        items: {
          create: input.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            const price =
              session?.user.isMember && product.memberPrice
                ? product.memberPrice
                : product.basePrice;
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: price,
            };
          }),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/orders]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
