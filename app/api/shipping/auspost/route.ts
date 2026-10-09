import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDomesticParcelRates } from "@/lib/auspost";
import { createShippingQuoteToken } from "@/lib/shipping-quote";
import { db } from "@/lib/db";
import { buildParcelGroups, FreightRequiredError, shipmentKey } from "@/lib/shipping-packages";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  postcode: z.string().regex(/^\d{4}$/, "Must be a 4-digit postcode"),
  items: z.array(z.object({
    productId: z.string().cuid(),
    variantId: z.string().cuid().optional(),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(50),
});

export async function POST(req: NextRequest) {
  try {
    // SEC-8: Require authentication to prevent API abuse
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // SEC-8: Rate limit shipping quote requests (20 per minute per user/IP)
    const identifier = session.user.id ?? getClientIp(req.headers);
    const rateLimit = await consumeRateLimit("shipping-quote", identifier, 20, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    const body = await req.json();
    const { postcode, items } = schema.parse(body);
    const productIds = [...new Set(items.map(item => item.productId))];
    const products = await db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true, weight: true, length: true, width: true, height: true,
        productVariants: { where: { isActive: true }, select: { id: true, weight: true, length: true, width: true, height: true } },
      },
    });
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "One or more products are unavailable" }, { status: 400 });
    }
    const groups = buildParcelGroups(items.map(item => {
      const product = products.find(value => value.id === item.productId)!;
      const variant = item.variantId ? product.productVariants.find(value => value.id === item.variantId) : null;
      if (item.variantId && !variant) throw new FreightRequiredError("A selected product variant is unavailable.");
      return {
        key: `${item.productId}:${item.variantId ?? "base"}`,
        quantity: item.quantity,
        weight: variant?.weight ?? product.weight,
        length: variant?.length ?? product.length,
        width: variant?.width ?? product.width,
        height: variant?.height ?? product.height,
      };
    }));
    const key = shipmentKey(groups);
    const rates = (await getDomesticParcelRates(postcode, groups)).map((rate) => ({
      ...rate,
      quoteToken: createShippingQuoteToken({
        postcode,
        shipmentKey: key,
        serviceCode: rate.serviceCode,
        price: rate.price,
      }),
    }));

    return NextResponse.json({ rates });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    if (error instanceof FreightRequiredError) {
      return NextResponse.json({ error: error.message, freightRequired: true }, { status: 422 });
    }
    console.error("[POST /api/shipping/auspost]", error);
    return NextResponse.json(
      { error: "Failed to fetch shipping rates" },
      { status: 500 }
    );
  }
}
