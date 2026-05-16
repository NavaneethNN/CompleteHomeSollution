import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { createCheckoutSession } from "@/lib/stripe";

const addressSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(1),
  line1: z.string().min(3),
  line2: z.string().optional(),
  suburb: z.string().min(2),
  state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]),
  postcode: z.string().length(4),
  country: z.string().default("AU"),
});

const checkoutSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string(),
          variantId: z.string().optional(),
          quantity: z.number().int().positive(),
        })
      )
      .min(1, "Cart cannot be empty"),
    // address is only required when savedAddressId is not provided
    address: addressSchema.optional(),
    savedAddressId: z.string().optional(),
    guestEmail: z.string().email().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.savedAddressId && !data.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Address is required",
        path: ["address"],
      });
    }
  });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const input = checkoutSchema.parse(body);

    // Resolve address: use saved address or create new one
    let addressId: string;

    if (input.savedAddressId) {
      // Verify the saved address belongs to user
      const existing = await db.address.findFirst({
        where: {
          id: input.savedAddressId,
          ...(session?.user?.id ? { userId: session.user.id } : {}),
        },
      });
      if (!existing) {
        return NextResponse.json({ error: "Address not found" }, { status: 400 });
      }
      addressId = existing.id;
    } else {
      // Create new address (superRefine guarantees input.address is defined here)
      const addr = input.address!;
      const address = await db.address.create({
        data: {
          ...(session?.user?.id ? { userId: session.user.id } : {}),
          name: addr.name,
          phone: addr.phone,
          line1: addr.line1,
          line2: addr.line2 || null,
          suburb: addr.suburb,
          state: addr.state,
          postcode: addr.postcode,
          country: addr.country || "AU",
        },
      });
      addressId = address.id;
    }

    // Fetch products and calculate prices
    const productIds = input.items.map((i) => i.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      include: { productVariants: true },
    });

    let subtotal = 0;
    const lineItems: {
      price_data: { currency: string; product_data: { name: string }; unit_amount: number };
      quantity: number;
    }[] = [];

    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found` },
          { status: 400 }
        );
      }

      let unitPrice: number;
      const itemName = product.name;

      if (item.variantId) {
        const variant = product.productVariants.find((v) => v.id === item.variantId);
        if (!variant) {
          return NextResponse.json({ error: `Variant not found` }, { status: 400 });
        }
        if (variant.stock < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${product.name}` },
            { status: 400 }
          );
        }
        unitPrice =
          session?.user?.isMember && variant.memberPrice
            ? variant.memberPrice
            : variant.price;
      } else {
        if (product.stock < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${product.name}` },
            { status: 400 }
          );
        }
        unitPrice =
          session?.user?.isMember && product.memberPrice
            ? product.memberPrice
            : product.basePrice;
      }

      subtotal += unitPrice * item.quantity;
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: { name: itemName },
          unit_amount: Math.round(unitPrice * 100), // Stripe uses cents
        },
        quantity: item.quantity,
      });
    }

    // Calculate totals
    const shippingCost = subtotal >= 1200 ? 0 : 79;
    const tax = Math.round(subtotal * 0.1 * 100) / 100; // 10% GST
    const total = subtotal + shippingCost + tax;

    // Add shipping as line item if not free
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: { name: "Shipping" },
          unit_amount: shippingCost * 100,
        },
        quantity: 1,
      });
    }

    // Add tax as line item
    if (tax > 0) {
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: { name: "GST (10%)" },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    // Create the order in DB
    const order = await db.order.create({
      data: {
        ...(session?.user?.id ? { userId: session.user.id } : {}),
        guestEmail: input.guestEmail || null,
        guestPhone: !session?.user?.id ? (input.address?.phone ?? null) : null,
        addressId,
        subtotal,
        shippingCost,
        tax,
        total,
        status: "PENDING",
        items: {
          create: input.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            let unitPrice: number;
            if (item.variantId) {
              const variant = product.productVariants.find((v) => v.id === item.variantId);
              unitPrice =
                session?.user?.isMember && variant?.memberPrice
                  ? variant.memberPrice
                  : variant?.price || product.basePrice;
            } else {
              unitPrice =
                session?.user?.isMember && product.memberPrice
                  ? product.memberPrice
                  : product.basePrice;
            }
            return {
              productId: item.productId,
              productVariantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice,
            };
          }),
        },
      },
    });

    // Determine customer email
    const customerEmail =
      session?.user?.email || input.guestEmail || undefined;

    // Create Stripe Checkout Session
    const origin = req.headers.get("origin") || process.env.AUTH_URL || "http://localhost:3000";
    const checkoutSession = await createCheckoutSession({
      lineItems,
      orderId: order.id,
      customerEmail,
      successUrl: `${origin}/order-confirmation/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout?cancelled=true`,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      orderId: order.id,
    });
  } catch (error) {
    console.error("[POST /api/checkout/session]", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create checkout session. Please try again." },
      { status: 500 }
    );
  }
}
