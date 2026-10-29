import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  checkCouriersPleaseAvailability,
  getCouriersPleaseRates,
  CouriersPleaseError,
} from "@/lib/couriersplease";
import { createShippingQuoteToken, shippingDestinationKey } from "@/lib/shipping-quote";
import { db } from "@/lib/db";
import { buildParcelGroups, FreightRequiredError, shipmentKey } from "@/lib/shipping-packages";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  address: z.object({
    name: z.string().trim().min(2).max(120),
    line1: z.string().trim().min(3).max(120),
    line2: z.string().trim().max(120).nullish(),
    suburb: z.string().trim().min(2).max(120),
    state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]),
    postcode: z.string().regex(/^\d{4}$/, "Must be a 4-digit postcode"),
    country: z.literal("AU"),
    phone: z.string().trim().max(40).nullish(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        variantId: z.string().cuid().nullish(),
        quantity: z.number().int().positive().max(100),
      })
    )
    .min(1)
    .max(50),
});

export async function GET(req: NextRequest) {
  const limit = await consumeRateLimit("shipping-availability", getClientIp(req.headers), 20, 60);
  if (!limit.allowed) return rateLimitResponse(limit);

  const availability = checkCouriersPleaseAvailability();
  return NextResponse.json(availability, {
    status: availability.available ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    // Rate limit shipping quote requests (20 per minute per user/IP)
    const identifier = session?.user?.id ?? getClientIp(req.headers);
    const rateLimit = await consumeRateLimit("shipping-quote", identifier, 20, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { address, items } = schema.parse(body);
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true,
        weight: true,
        length: true,
        width: true,
        height: true,
        productVariants: {
          where: { isActive: true },
          select: { id: true, weight: true, length: true, width: true, height: true },
        },
      },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "One or more products are unavailable" }, { status: 400 });
    }

    const groups = buildParcelGroups(
      items.map((item) => {
        const product = products.find((val) => val.id === item.productId)!;
        const variant = item.variantId
          ? product.productVariants.find((val) => val.id === item.variantId)
          : null;
        if (item.variantId && !variant) {
          throw new FreightRequiredError("A selected product variant is unavailable.");
        }
        return {
          key: `${item.productId}:${item.variantId ?? "base"}`,
          quantity: item.quantity,
          weight: variant?.weight ?? product.weight,
          length: variant?.length ?? product.length,
          width: variant?.width ?? product.width,
          height: variant?.height ?? product.height,
        };
      })
    );

    const key = shipmentKey(groups);
    const rates = (await getCouriersPleaseRates(address, groups)).map((rate) => ({
      ...rate,
      quoteToken: createShippingQuoteToken({
        postcode: address.postcode,
        destinationKey: shippingDestinationKey(address),
        shipmentKey: key,
        serviceCode: rate.serviceCode,
        price: rate.price,
      }),
    }));

    return NextResponse.json({ rates });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Please check ${error.issues[0].path.join(".") || "shipping details"}: ${error.issues[0].message}` },
        { status: 400 }
      );
    }
    if (error instanceof FreightRequiredError) {
      return NextResponse.json({ error: error.message, freightRequired: true }, { status: 422 });
    }
    if (error instanceof CouriersPleaseError) {
      console.error("[POST /api/shipping/couriersplease]", { message: error.message, code: error.code });
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[POST /api/shipping/couriersplease]", error);
    return NextResponse.json(
      { error: "Failed to fetch shipping rates from Couriers Please" },
      { status: 500 }
    );
  }
}

