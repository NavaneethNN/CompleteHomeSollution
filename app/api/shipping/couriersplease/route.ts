import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { auth } from "@/auth";
import {
  checkCouriersPleaseAvailability,
  getCouriersPleaseRates,
  CouriersPleaseError,
} from "@/lib/couriersplease";
import { createShippingQuoteToken, shippingDestinationKey } from "@/lib/shipping-quote";
import { db } from "@/lib/db";
import { buildPackagedParcelGroups, FreightRequiredError, shipmentKey } from "@/lib/shipping-packages";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { isLargeProduct, getManualDeliveryPostcodeRate } from "@/lib/manual-delivery";
import {
  expandCourierProductVariantsForLargeCheck,
  resolveCourierPackageSet,
} from "@/lib/variant-dimensions";
import {
  MEMBER_FREE_DELIVERY_CODE,
  MEMBER_FIXED_DELIVERY_CODE,
  buildMemberOverriddenShipmentKey,
  memberDeliveryShipmentKey,
  partitionCartForMemberDelivery,
} from "@/lib/member-delivery";

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
  addMembership: z.boolean().optional(),
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

    const { address, addMembership, items } = schema.parse(body);
    const productIds = [...new Set(items.map((item) => item.productId))];
    const [products, currentUser] = await Promise.all([
      db.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          isLargeItem: true,
          memberFreeDelivery: true,
          memberDeliveryCharge: true,
          requiresPackaging: true,
          weight: true,
          length: true,
          width: true,
          height: true,
          extraPackages: true,
          category: { select: { slug: true, name: true } },
          productVariants: {
            where: { isActive: true },
            select: {
              id: true,
              weight: true,
              length: true,
              width: true,
              height: true,
              requiresPackaging: true,
              extraPackages: true,
            },
          },
        },
      }),
      session?.user?.id && typeof db.user?.findUnique === "function"
        ? db.user.findUnique({
            where: { id: session.user.id },
            select: { isMember: true, membershipExpiry: true },
          })
        : Promise.resolve(null),
    ]);

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "One or more products are unavailable" }, { status: 400 });
    }

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;
      if (item.variantId && !product.productVariants.some((val) => val.id === item.variantId)) {
        throw new FreightRequiredError("A selected product variant is unavailable.");
      }
    }

    const isMemberFromDb =
      !!currentUser?.isMember &&
      (!currentUser.membershipExpiry || currentUser.membershipExpiry > new Date());
    const wantsMembership = Boolean(addMembership) && Boolean(session?.user?.id);
    const effectiveMember = isMemberFromDb || wantsMembership;

    const partition = partitionCartForMemberDelivery(
      items,
      (item) => products.find((p) => p.id === item.productId),
      effectiveMember
    );

    if (partition.allOverridden) {
      const price = Math.round(partition.fixedDeliveryCents) / 100;
      const isFree = partition.fixedDeliveryCents === 0;
      const serviceCode = isFree ? MEMBER_FREE_DELIVERY_CODE : MEMBER_FIXED_DELIVERY_CODE;
      const serviceName = isFree
        ? "Free Delivery (Member Perk)"
        : "Standard Delivery (Member Rate)";
      const tokenShipmentKey = buildMemberOverriddenShipmentKey(
        items,
        partition.fixedDeliveryCents
      );
      const rates = [
        {
          serviceCode,
          serviceName,
          price,
          deliveryTime: "5–7 working days",
          quoteToken: createShippingQuoteToken({
            postcode: address.postcode,
            destinationKey: shippingDestinationKey(address),
            shipmentKey: tokenShipmentKey,
            serviceCode,
            price,
          }),
          packaging: null,
        },
      ];
      return NextResponse.json({ rates, hasLargeItems: false, storePickupAvailable: true });
    }

    const hasLargeItems = partition.standardItems.some((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return false;
      const variant = item.variantId
        ? product.productVariants.find((v) => v.id === item.variantId)
        : null;
      return expandCourierProductVariantsForLargeCheck(product, variant).some((entry) =>
        isLargeProduct(entry)
      );
    });

    // For large items (e.g. sofas) without member delivery overrides, CouriersPlease is not available.
    // Instead, delivery is handled separately by the admin itself for covered postcodes,
    // or store pickup is offered.
    if (hasLargeItems) {
      const manualRate = await getManualDeliveryPostcodeRate(address.postcode);
      if (manualRate && manualRate.available) {
        const finalManualPrice =
          Math.round((manualRate.charge * 100 + partition.fixedDeliveryCents)) / 100;
        const rates = [
          {
            serviceCode: "MANUAL_DELIVERY",
            serviceName: "Standard Delivery",
            price: finalManualPrice,
            deliveryTime: "5–7 working days",
            isManualDelivery: true,
            quoteToken: createShippingQuoteToken({
              postcode: address.postcode,
              destinationKey: shippingDestinationKey(address),
              shipmentKey: memberDeliveryShipmentKey("MANUAL_DELIVERY", partition),
              serviceCode: "MANUAL_DELIVERY",
              price: finalManualPrice,
            }),
          },
        ];
        return NextResponse.json({
          rates,
          hasLargeItems: true,
          manualDeliveryAvailable: true,
          storePickupAvailable: true,
        });
      } else {
        return NextResponse.json({
          rates: [],
          hasLargeItems: true,
          manualDeliveryAvailable: false,
          storePickupAvailable: true,
          message: `Delivery is not available to postcode ${address.postcode} for these items. Please select Store Pickup.`,
        });
      }
    }

    const shippingItems = partition.standardItems.map((item) => {
      const product = products.find((val) => val.id === item.productId)!;
      const variant = item.variantId
        ? product.productVariants.find((val) => val.id === item.variantId)
        : null;
      if (item.variantId && !variant) {
        throw new FreightRequiredError("A selected product variant is unavailable.");
      }
      const pkg = resolveCourierPackageSet(product, variant);
      return {
        key: `${item.productId}:${item.variantId ?? "base"}`,
        quantity: item.quantity,
        weight: pkg.weight,
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        requiresPackaging: pkg.requiresPackaging,
        extraPackages: pkg.extraPackages,
        label: product.name,
      };
    });

    const { groups, packaging } = await buildPackagedParcelGroups(shippingItems);

    const key = memberDeliveryShipmentKey(shipmentKey(groups), partition);
    const allRates = await getCouriersPleaseRates(address, groups);
    if (!allRates || allRates.length === 0) {
      return NextResponse.json(
        { error: "No delivery services available for this destination" },
        { status: 404 }
      );
    }

    // Select the best suitable delivery option automatically based on dimensions, weight and distance
    const bestRate = allRates[0];
    const finalPrice = Math.round((bestRate.price * 100 + partition.fixedDeliveryCents)) / 100;
    const rates = [
      {
        serviceCode: bestRate.serviceCode,
        serviceName: "Standard Delivery",
        price: finalPrice,
        deliveryTime: "5–7 working days",
        quoteToken: createShippingQuoteToken({
          postcode: address.postcode,
          destinationKey: shippingDestinationKey(address),
          shipmentKey: key,
          serviceCode: bestRate.serviceCode,
          price: finalPrice,
        }),
        packaging,
      },
    ];

    return NextResponse.json({ rates, hasLargeItems: false, storePickupAvailable: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Please check ${error.issues[0].path.join(".") || "shipping details"}: ${error.issues[0].message}` },
        { status: 400 }
      );
    }
    if (error instanceof FreightRequiredError) {
      return NextResponse.json({
        error: error.message,
        freightRequired: true,
        storePickupAvailable: true,
      }, { status: 422 });
    }
    if (error instanceof CouriersPleaseError) {
      console.error("[POST /api/shipping/couriersplease]", { message: error.message, code: error.code });
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[POST /api/shipping/couriersplease]", error);
    Sentry.captureException(error, {
      tags: { route: "POST /api/shipping/couriersplease" },
    });
    return NextResponse.json(
      { error: "Failed to fetch shipping rates from Couriers Please" },
      { status: 500 }
    );
  }
}

