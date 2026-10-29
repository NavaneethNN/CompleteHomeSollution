import { hasActiveMembership } from "@/lib/membership";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { OrderStatus } from "@prisma/client";
import { createOrderSchema } from "@/lib/validations/order";

/**
 * REL-6 fix: The POST handler on this legacy route creates complete orders
 * (including stock decrements) without any payment step. Any authenticated user
 * could exploit this to receive goods for free. The GET handler is legitimate
 * and remains unchanged.
 *
 * The POST route is now gated behind an INTERNAL_API_SECRET header check.
 * Requests without the correct secret receive a 404 (not 401/403) to avoid
 * leaking the existence of this endpoint to probing attackers.
 *
 * This route should only be called by trusted internal services (e.g. admin
 * tooling, data migration scripts) that have access to the secret. Regular
 * user-facing order placement must go through POST /api/checkout/session.
 */

function verifyInternalSecret(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    // If the env var is not set, block ALL requests to be safe
    console.error("[POST /api/orders] INTERNAL_API_SECRET is not configured — blocking request");
    return false;
  }
  const provided = req.headers.get("x-internal-secret");
  // Use a constant-time comparison to prevent timing attacks
  if (!provided || provided.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const where =
      session.user.role === "ADMIN" ? {} : { userId: session.user.id };

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    if (status && !Object.values(OrderStatus).includes(status as OrderStatus)) {
      return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
    }
    if (status) Object.assign(where, { status });
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

    const orders = await db.order.findMany({
      where,
      include: {
        items: {
          include: {
            // S-5: Only expose required product fields, not the full product object
            product: { select: { id: true, name: true, images: true, slug: true } },
          },
        },
        address: true,
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    return NextResponse.json({ data: orders });
  } catch (error) {
    console.error("[GET /api/orders]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // REL-6: Block all requests that don't carry the correct internal secret.
  // Return 404 so the endpoint is not fingerprintable by external callers.
  if (!verifyInternalSecret(req)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const session = await auth();
    const body = await req.json();
    const input = createOrderSchema.parse(body);

    // S-4: Always fetch isMember fresh from DB — never trust JWT for pricing decisions
    let isMemberFromDb = false;
    if (session?.user?.id) {
      const currentUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { isMember: true, membershipExpiry: true },
      });
      isMemberFromDb = hasActiveMembership(currentUser);
    }

    const products = await db.product.findMany({
      where: { id: { in: input.items.map((i) => i.productId) }, isActive: true },
      select: {
        id: true,
        name: true,
        basePrice: true,
        memberPrice: true,
        stock: true,
      },
    });

    // Pre-validate stock before starting any writes
    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 400 });
      }
    }

    const TAX_RATE = 0.1;
    const shippingCost = 15;

    // B-1: Use a DB transaction to atomically create the order AND decrement stock
    const order = await db.$transaction(async (tx) => {
      // Re-check stock inside transaction and decrement atomically
      for (const item of input.items) {
        const product = products.find((p) => p.id === item.productId)!;

        const fresh = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true },
        });
        if (!fresh || fresh.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      const address = await tx.address.create({
        data: {
          ...(session?.user?.id ? { userId: session.user.id } : {}),
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

      let subtotal = 0;
      const itemsData = input.items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        const price =
          isMemberFromDb && product.memberPrice
            ? product.memberPrice
            : product.basePrice;
        subtotal += price * item.quantity;
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: price,
        };
      });

      const tax = 0;
      const total = subtotal + shippingCost;

      return tx.order.create({
        data: {
          ...(session?.user?.id ? { userId: session.user.id } : {}),
          guestEmail: input.guestInfo?.email,
          guestPhone: input.guestInfo?.phone,
          addressId: address.id,
          subtotal,
          shippingCost,
          tax,
          total,
          items: { create: itemsData },
        },
        include: { items: true },
      });
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/orders]", error);
    if (error instanceof Error && error.message.startsWith("Insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
