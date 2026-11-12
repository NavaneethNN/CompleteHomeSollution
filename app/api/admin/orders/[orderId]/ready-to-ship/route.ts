import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { processDueEmailJobs } from "@/lib/email-outbox";
import {
  checkCouriersPleaseAvailability,
  couriersPleaseSenderFromEnv,
  createCouriersPleaseDispatch,
  bookCouriersPleasePickup,
  summarizeCouriersPleaseItems,
  parseConsignmentCodes,
  isCouriersPleaseTestMode,
  CouriersPleaseError,
  CouriersPleasePartialBookingError,
} from "@/lib/couriersplease";
import { getTrackingUrl } from "@/lib/tracking-url";
import {
  resolveOrderShipmentBoxes,
  parseStoredPackedBoxes,
  type PackedBoxSpec,
} from "@/lib/shipping-packages";

type Context = { params: Promise<{ orderId: string }> };

const packedBoxInputSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
  length: z.coerce.number().positive("Length must be greater than 0").max(300, "Length cannot exceed 300cm"),
  width: z.coerce.number().positive("Width must be greater than 0").max(300, "Width cannot exceed 300cm"),
  height: z.coerce.number().positive("Height must be greater than 0").max(300, "Height cannot exceed 300cm"),
  weight: z.coerce.number().positive("Weight must be greater than 0").max(100, "Weight cannot exceed 100kg"),
});

const bodySchema = z.object({
  action: z.enum(["book", "retry_pickup", "reconcile"]).optional(),
  knownConsignmentCode: z.string().trim().min(3, "Consignment code is required").max(80).optional(),
  readyDateTime: z.string().trim().optional(),
  specialInstructions: z.string().trim().max(140).optional(),
  pickupInstructions: z.string().trim().max(15).optional(),
  packedLength: z.coerce.number().positive("Length must be greater than 0").max(300, "Length cannot exceed 300cm").optional(),
  packedWidth: z.coerce.number().positive("Width must be greater than 0").max(300, "Width cannot exceed 300cm").optional(),
  packedHeight: z.coerce.number().positive("Height must be greater than 0").max(300, "Height cannot exceed 300cm").optional(),
  packedWeight: z.coerce.number().positive("Weight must be greater than 0").max(100, "Weight cannot exceed 100kg").optional(),
  packedBoxes: z.array(packedBoxInputSchema).min(1).max(100).optional(),
});

function parsePickupState(createState: string | null | undefined): {
  jobNumber: string | null;
  pickupPending: boolean;
} {
  if (!createState) return { jobNumber: null, pickupPending: false };
  if (createState.startsWith("CP_JOB:")) {
    return { jobNumber: createState.slice(7) || null, pickupPending: false };
  }
  return {
    jobNumber: null,
    pickupPending: createState === "CP_PICKUP_PENDING",
  };
}

async function orderForShipping(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      address: true,
      user: { select: { email: true, name: true, phone: true } },
      items: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              weight: true,
              length: true,
              width: true,
              height: true,
              extraPackages: true,
              requiresPackaging: true,
            },
          },
          productVariant: {
            select: {
              weight: true,
              length: true,
              width: true,
              height: true,
              extraPackages: true,
              requiresPackaging: true,
            },
          },
        },
      },
    },
  });
}

export async function GET(_req: NextRequest, { params }: Context) {
  if (!(await hasFreshAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  if (!/^c[a-z0-9]{24,}$/.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const order = await orderForShipping(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const availability = checkCouriersPleaseAvailability();
    let sender = null;
    try {
      sender = couriersPleaseSenderFromEnv();
    } catch {
      // Ignore if not configured
    }

    const resolvedBoxes = await resolveOrderShipmentBoxes(order);
    const hasStoredBoxes = parseStoredPackedBoxes((order as { packedBoxes?: unknown }).packedBoxes).length > 0;

    if (!hasStoredBoxes && (!order.packedLength || !order.packedWeight)) {
      // Persist resolved separate-box dimensions so all views and future queries match
      await db.order
        .update({
          where: { id: order.id },
          data: {
            packagePresetId: resolvedBoxes.packagePresetId,
            packageName: resolvedBoxes.packageName,
            packedLength: resolvedBoxes.packedLength,
            packedWidth: resolvedBoxes.packedWidth,
            packedHeight: resolvedBoxes.packedHeight,
            packedWeight: resolvedBoxes.packedWeight,
            packedBoxes: resolvedBoxes.boxes as any,
            packageOverride: order.packageOverride ?? false,
          },
        })
        .catch((err) => console.error("[ready-to-ship auto-persist] note:", err));
    }

    const isBooked = !!order.trackingNumber && !!order.carrier?.toLowerCase().includes("couriers please");
    const consignmentCodes = parseConsignmentCodes(order.trackingNumber);
    const trackingUrl = consignmentCodes[0]
      ? getTrackingUrl(order.carrier, consignmentCodes.length === 1 ? consignmentCodes[0] : consignmentCodes.join(", "))
      : null;
    const pickupState = parsePickupState(order.ship123CreateState);
    const bookingMode =
      consignmentCodes.length > 1
        ? "SEPARATE_CONSIGNMENTS"
        : resolvedBoxes.totalBoxCount > 1
        ? "MULTI_PARCEL"
        : "SINGLE";

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        shippingServiceCode: order.shippingServiceCode,
        ship123OrderNo: order.ship123OrderNo,
        ship123LabelUrl: order.ship123LabelUrl,
        ship123CreateState: order.ship123CreateState,
        packageName: order.packageName || resolvedBoxes.packageName,
        packedWeight: order.packedWeight || resolvedBoxes.packedWeight,
        packedLength: order.packedLength || resolvedBoxes.packedLength,
        packedWidth: order.packedWidth || resolvedBoxes.packedWidth,
        packedHeight: order.packedHeight || resolvedBoxes.packedHeight,
        packedBoxes: resolvedBoxes.boxes,
        totalBoxCount: resolvedBoxes.totalBoxCount,
        packageOverride: order.packageOverride ?? false,
      },
      recipient: order.address
        ? {
            name: order.address.name,
            line1: order.address.line1,
            line2: order.address.line2,
            suburb: order.address.suburb,
            state: order.address.state,
            postcode: order.address.postcode,
          }
        : null,
      isBooked,
      bookingMode,
      consignmentCodes,
      jobNumber: pickupState.jobNumber,
      pickupPending: pickupState.pickupPending,
      createState: order.ship123CreateState,
      isTestMode: isCouriersPleaseTestMode(),
      trackingUrl,
      availability,
      sender,
    });
  } catch (error) {
    console.error("[CouriersPlease admin GET]", error);
    return NextResponse.json({ error: "Failed to load order shipment details" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Context) {
  if (!(await hasFreshAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  if (!/^c[a-z0-9]{24,}$/.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  const {
    action,
    knownConsignmentCode,
    readyDateTime,
    specialInstructions,
    pickupInstructions,
    packedLength,
    packedWidth,
    packedHeight,
    packedWeight,
    packedBoxes,
  } = parsed.data;

  let claimed = false;

  try {
    const order = await orderForShipping(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.address) {
      return NextResponse.json({ error: "Order is missing shipping delivery address" }, { status: 400 });
    }

    if (order.fulfillmentType === "STORE_PICKUP" || order.fulfillmentType === "MANUAL_DELIVERY") {
      return NextResponse.json(
        { error: `Cannot book courier consignment for a ${order.fulfillmentType === "STORE_PICKUP" ? "Store Pickup" : "Manual Local Delivery"} order.` },
        { status: 409 }
      );
    }

    const recipient = {
      name: order.address.name,
      line1: order.address.line1,
      line2: order.address.line2,
      suburb: order.address.suburb,
      state: order.address.state,
      postcode: order.address.postcode,
      phone: order.address.phone || order.user?.phone || order.guestPhone || "0400000000",
      email: order.user?.email || order.guestEmail,
    };

    const explicitBoxes: PackedBoxSpec[] | null =
      packedBoxes && packedBoxes.length > 0
        ? packedBoxes.map((box, idx) => ({
            label: box.label?.trim() || `Box ${idx + 1}`,
            quantity: box.quantity,
            length: Math.round(box.length * 10) / 10,
            width: Math.round(box.width * 10) / 10,
            height: Math.round(box.height * 10) / 10,
            weight: Math.round(box.weight * 100) / 100,
          }))
        : packedLength && packedWidth && packedHeight && packedWeight
          ? [
              {
                label: order.packageName || "Packed Order",
                quantity: 1,
                length: Math.round(packedLength * 10) / 10,
                width: Math.round(packedWidth * 10) / 10,
                height: Math.round(packedHeight * 10) / 10,
                weight: Math.round(packedWeight * 100) / 100,
              },
            ]
          : null;

    const resolvedShipment = explicitBoxes
      ? (() => {
          const totalBoxCount = explicitBoxes.reduce((sum, b) => sum + b.quantity, 0);
          const totalWeight =
            Math.round(explicitBoxes.reduce((sum, b) => sum + b.weight * b.quantity, 0) * 100) / 100;
          const first = explicitBoxes[0];
          const packageName =
            totalBoxCount === 1 ? first.label : `${totalBoxCount} Boxes (Separate Packaging)`;
          return {
            boxes: explicitBoxes,
            packagePresetId: null,
            packageName,
            packedLength: first.length,
            packedWidth: first.width,
            packedHeight: first.height,
            packedWeight: totalWeight,
            totalBoxCount,
          };
        })()
      : await resolveOrderShipmentBoxes(order);

    const activeBoxes = resolvedShipment.boxes;
    const consignmentItems = activeBoxes.map((box) => ({
      quantity: box.quantity,
      length: box.length,
      width: box.width,
      height: box.height,
      weight: box.weight,
      description: box.label,
    }));

    const packagedSummary = summarizeCouriersPleaseItems(consignmentItems);
    const perBoxWeights = consignmentItems.flatMap((it) =>
      Array.from({ length: Math.max(1, it.quantity) }, () => it.weight)
    );

    // Handle already-booked Couriers Please consignments (idempotent or pickup retry)
    if (order.trackingNumber && order.carrier?.toLowerCase().includes("couriers please")) {
      const existingCodes = parseConsignmentCodes(order.trackingNumber);
      const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber);
      const labelUrl = order.ship123LabelUrl || `/api/admin/orders/${order.id}/couriersplease/label`;
      const existingPickup = parsePickupState(order.ship123CreateState);

      if (action === "retry_pickup") {
        if (!["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status)) {
          return NextResponse.json(
            { error: `Cannot schedule pickup when order status is ${order.status}` },
            { status: 409 }
          );
        }
        const availability = checkCouriersPleaseAvailability();
        if (!availability.available) {
          return NextResponse.json({ error: availability.reason || "Couriers Please unavailable" }, { status: 503 });
        }

        const pickupResult = await bookCouriersPleasePickup({
          consignmentCode: order.trackingNumber,
          consignmentCodes: existingCodes,
          perConsignmentWeights: perBoxWeights,
          recipient,
          readyDateTime,
          totalItemCount: packagedSummary.totalItemCount,
          totalWeight: packagedSummary.totalWeight,
          pickupInstructions: pickupInstructions || specialInstructions,
        });

        await db.order.update({
          where: { id: order.id },
          data: {
            ship123CreateState: `CP_JOB:${pickupResult.jobNumber}`,
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          consignmentCode: order.trackingNumber,
          consignmentCodes: existingCodes,
          trackingNumber: order.trackingNumber,
          jobNumber: pickupResult.jobNumber,
          pickupBooked: true,
          pickupPending: false,
          labelUrl,
          trackingUrl,
          message: `Pickup scheduled with job #${pickupResult.jobNumber}`,
        });
      }

      return NextResponse.json({
        alreadyBooked: true,
        consignmentCode: order.trackingNumber,
        consignmentCodes: existingCodes,
        trackingNumber: order.trackingNumber,
        jobNumber: existingPickup.jobNumber,
        pickupBooked: Boolean(existingPickup.jobNumber),
        pickupPending: existingPickup.pickupPending,
        labelUrl,
        trackingUrl,
        message: "Order already booked with Couriers Please",
        packedLength: order.packedLength,
        packedWidth: order.packedWidth,
        packedHeight: order.packedHeight,
        packedWeight: order.packedWeight,
      });
    }

    if (!["PAID", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(order.status) || !order.items.length) {
      return NextResponse.json(
        { error: "Only paid physical orders can be dispatched with Couriers Please" },
        { status: 409 }
      );
    }

    const availability = checkCouriersPleaseAvailability();
    if (!availability.available) {
      return NextResponse.json(
        { error: availability.reason || "Couriers Please credentials are not configured" },
        { status: 503 }
      );
    }

    // Reconcile uncertain state if admin supplies existing Couriers Please consignment code
    if (knownConsignmentCode) {
      if (!["CREATING", "CP_CREATING", "UNKNOWN", "CP_UNKNOWN"].includes(order.ship123CreateState ?? "")) {
        return NextResponse.json({ error: "No uncertain Couriers Please booking to reconcile" }, { status: 409 });
      }
      if (
        ["CREATING", "CP_CREATING"].includes(order.ship123CreateState ?? "") &&
        order.ship123CreateStartedAt &&
        Date.now() - order.ship123CreateStartedAt.getTime() < 60_000
      ) {
        return NextResponse.json(
          { error: "Couriers Please booking is still in progress. Please wait up to 60 seconds before reconciling." },
          { status: 409 }
        );
      }

      const labelUrl = `/api/admin/orders/${order.id}/couriersplease/label`;
      const prevStatus = order.status;
      const newStatus = "SHIPPED";
      let jobNumber: string | null = null;
      let pickupWarning: string | null = null;

      try {
        const pickupResult = await bookCouriersPleasePickup({
          consignmentCode: knownConsignmentCode,
          recipient,
          readyDateTime,
          totalItemCount: packagedSummary.totalItemCount,
          totalWeight: packagedSummary.totalWeight,
          pickupInstructions: pickupInstructions || specialInstructions,
        });
        jobNumber = pickupResult.jobNumber;
      } catch (pickupErr) {
        pickupWarning = pickupErr instanceof Error ? pickupErr.message : "Pickup scheduling failed";
      }

      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            carrier: "Couriers Please",
            trackingNumber: knownConsignmentCode,
            ship123OrderNo: knownConsignmentCode,
            ship123LabelUrl: labelUrl,
            ship123CreateState: jobNumber ? `CP_JOB:${jobNumber}` : "CP_PICKUP_PENDING",
            status: newStatus,
            updatedAt: new Date(),
          },
        });
        if (prevStatus !== newStatus) {
          await tx.emailJob.createMany({
            data: [
              {
                key: `order:${order.id}:status:${newStatus}:${randomUUID()}`,
                kind: "ORDER_STATUS",
                orderId: order.id,
                payload: {
                  status: newStatus,
                  previousStatus: prevStatus,
                  trackingNumber: knownConsignmentCode,
                  carrier: "Couriers Please",
                },
              },
            ],
            skipDuplicates: true,
          });
        }
      });

      await processDueEmailJobs().catch((emailErr) => {
        console.error("[CouriersPlease reconcile] Email dispatch note:", emailErr);
      });

      return NextResponse.json({
        success: true,
        consignmentCode: knownConsignmentCode,
        trackingNumber: knownConsignmentCode,
        jobNumber,
        pickupBooked: Boolean(jobNumber),
        pickupPending: !jobNumber,
        pickupWarning,
        labelUrl,
        trackingUrl: getTrackingUrl("Couriers Please", knownConsignmentCode),
        packedLength: order.packedLength ?? resolvedShipment.packedLength,
        packedWidth: order.packedWidth ?? resolvedShipment.packedWidth,
        packedHeight: order.packedHeight ?? resolvedShipment.packedHeight,
        packedWeight: order.packedWeight ?? resolvedShipment.packedWeight,
        packedBoxes: activeBoxes,
        totalBoxCount: resolvedShipment.totalBoxCount,
      });
    }

    if (order.ship123CreateState && ["CREATING", "CP_CREATING", "UNKNOWN", "CP_UNKNOWN"].includes(order.ship123CreateState)) {
      const inProgress =
        ["CREATING", "CP_CREATING"].includes(order.ship123CreateState) &&
        order.ship123CreateStartedAt &&
        Date.now() - order.ship123CreateStartedAt.getTime() < 60_000;
      return NextResponse.json(
        {
          error: inProgress
            ? "Couriers Please booking is currently in progress. Please wait a moment and refresh."
            : "Previous Couriers Please booking outcome was uncertain. Check your Couriers Please portal and reconcile with the existing consignment code instead of double-booking.",
          createState: order.ship123CreateState,
        },
        { status: 409 }
      );
    }

    // Save newly confirmed dimensions & weight if provided by the admin before booking
    if (explicitBoxes) {
      await db.order.update({
        where: { id: order.id },
        data: {
          packageName: resolvedShipment.packageName,
          packedLength: resolvedShipment.packedLength,
          packedWidth: resolvedShipment.packedWidth,
          packedHeight: resolvedShipment.packedHeight,
          packedWeight: resolvedShipment.packedWeight,
          packedBoxes: activeBoxes as any,
          packageOverride: true,
        },
      });
      order.packageName = resolvedShipment.packageName;
      order.packedLength = resolvedShipment.packedLength;
      order.packedWidth = resolvedShipment.packedWidth;
      order.packedHeight = resolvedShipment.packedHeight;
      order.packedWeight = resolvedShipment.packedWeight;
      (order as any).packedBoxes = activeBoxes;
      order.packageOverride = true;
    }

    // Atomically claim lock before calling Couriers Please shipment/create
    const claim = await db.order.updateMany({
      where: {
        id: order.id,
        trackingNumber: null,
        ship123OrderNo: null,
        OR: [
          { ship123CreateState: null },
          { ship123CreateState: "CP_PICKUP_PENDING" },
        ],
        status: { in: ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED"] },
      },
      data: {
        ship123CreateState: "CP_CREATING",
        ship123CreateStartedAt: new Date(),
      },
    });
    if (!claim.count) {
      return NextResponse.json(
        { error: "Another booking request is in progress or this order has already been booked. Refresh and verify." },
        { status: 409 }
      );
    }
    claimed = true;

    // 1. Create Couriers Please shipment(s): uses multi-parcel consignment when supported,
    //    or falls back to separate per-box consignments if Couriers Please rejects multi-item.
    let dispatchResult: Awaited<ReturnType<typeof createCouriersPleaseDispatch>>;
    try {
      dispatchResult = await createCouriersPleaseDispatch({
        orderId: order.id,
        rateCardId: order.shippingServiceCode,
        recipient,
        items: consignmentItems,
        specialInstructions,
      });
    } catch (createErr) {
      if (createErr instanceof CouriersPleasePartialBookingError && createErr.partialConsignments.length > 0) {
        const partialCodes = createErr.partialConsignments.map((c) => c.consignmentCode);
        const partialTracking = partialCodes.join(", ");
        const partialLabelUrl = `/api/admin/orders/${order.id}/couriersplease/label`;
        await db.order
          .update({
            where: { id: order.id },
            data: {
              carrier: "Couriers Please",
              trackingNumber: partialTracking,
              ship123OrderNo: partialTracking,
              ship123LabelUrl: partialLabelUrl,
              ship123CreateState: "CP_PICKUP_PENDING",
              status: "SHIPPED",
              updatedAt: new Date(),
            },
          })
          .catch(() => {});
        claimed = false;
        return NextResponse.json(
          {
            error: createErr.message,
            consignmentCode: partialTracking,
            consignmentCodes: partialCodes,
          },
          { status: createErr.statusCode && createErr.statusCode >= 400 ? createErr.statusCode : 502 }
        );
      }

      // Definitive 4xx API rejection/validation failure never created a shipment — release lock cleanly.
      // Ambiguous network timeout / 5xx keeps CP_UNKNOWN to prevent accidental double billing.
      const isDefinitiveClientRejection =
        createErr instanceof CouriersPleaseError &&
        typeof createErr.statusCode === "number" &&
        createErr.statusCode >= 400 &&
        createErr.statusCode < 500;

      await db.order
        .updateMany({
          where: { id: order.id, ship123CreateState: "CP_CREATING", trackingNumber: null },
          data: {
            ship123CreateState: isDefinitiveClientRejection ? null : "CP_UNKNOWN",
            ...(isDefinitiveClientRejection ? { ship123CreateStartedAt: null } : {}),
          },
        })
        .catch(() => {});
      claimed = false;
      throw createErr;
    }

    const consignmentCode = dispatchResult.consignmentCode;
    const consignmentCodes = dispatchResult.consignmentCodes;
    const labelUrl = `/api/admin/orders/${order.id}/couriersplease/label`;
    const prevStatus = order.status;
    const newStatus = "SHIPPED";
    let jobNumber: string | null = dispatchResult.jobNumber ?? null;
    let pickupWarning: string | null = null;

    // Persist consignment(s) immediately so they are never lost even if pickup booking later fails
    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          carrier: "Couriers Please",
          trackingNumber: consignmentCode,
          ship123OrderNo: consignmentCode,
          ship123LabelUrl: labelUrl,
          shippingServiceCode: dispatchResult.rateCardId || order.shippingServiceCode,
          ship123CreateState: jobNumber ? `CP_JOB:${jobNumber}` : "CP_PICKUP_PENDING",
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      if (prevStatus !== newStatus) {
        await tx.emailJob.createMany({
          data: [
            {
              key: `order:${order.id}:status:${newStatus}:${randomUUID()}`,
              kind: "ORDER_STATUS",
              orderId: order.id,
              payload: {
                status: newStatus,
                previousStatus: prevStatus,
                trackingNumber: consignmentCode,
                carrier: "Couriers Please",
              },
            },
          ],
          skipDuplicates: true,
        });
      }
    });
    claimed = false;

    // 2. Book driver pickup covering all created consignment(s)
    if (!jobNumber) {
      try {
        const pickupResult = await bookCouriersPleasePickup({
          consignmentCode,
          consignmentCodes,
          perConsignmentWeights: perBoxWeights,
          recipient,
          readyDateTime,
          totalItemCount: packagedSummary.totalItemCount,
          totalWeight: packagedSummary.totalWeight,
          pickupInstructions: pickupInstructions || specialInstructions,
        });
        jobNumber = pickupResult.jobNumber;

        await db.order
          .update({
            where: { id: order.id },
            data: { ship123CreateState: `CP_JOB:${jobNumber}` },
          })
          .catch((err) => console.error("[CouriersPlease] Save jobNumber warning:", err));
      } catch (pickupErr) {
        console.error("[CouriersPlease] Pickup booking failed after consignment creation:", pickupErr);
        pickupWarning =
          pickupErr instanceof Error
            ? pickupErr.message
            : "Consignment created, but driver pickup could not be scheduled automatically.";
      }
    }

    // Send shipment notification email immediately
    await processDueEmailJobs().catch((emailErr) => {
      console.error("[CouriersPlease ready-to-ship] Email dispatch note:", emailErr);
    });

    const trackingUrl = getTrackingUrl("Couriers Please", consignmentCode);

    return NextResponse.json({
      success: true,
      bookingMode: dispatchResult.bookingMode,
      consignmentCode,
      consignmentCodes,
      trackingNumber: consignmentCode,
      rateCardId: dispatchResult.rateCardId,
      jobNumber,
      pickupBooked: Boolean(jobNumber),
      pickupPending: !jobNumber,
      pickupWarning,
      labelUrl,
      trackingUrl,
      packedLength: order.packedLength ?? resolvedShipment.packedLength,
      packedWidth: order.packedWidth ?? resolvedShipment.packedWidth,
      packedHeight: order.packedHeight ?? resolvedShipment.packedHeight,
      packedWeight: order.packedWeight ?? resolvedShipment.packedWeight,
      packedBoxes: activeBoxes,
      totalBoxCount: resolvedShipment.totalBoxCount,
    });
  } catch (error) {
    if (claimed) {
      await db.order
        .updateMany({
          where: { id: orderId, ship123CreateState: "CP_CREATING", trackingNumber: null },
          data: { ship123CreateState: "CP_UNKNOWN" },
        })
        .catch(() => {});
    }
    console.error("[CouriersPlease admin POST]", error);
    if (error instanceof CouriersPleaseError) {
      const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 503;
      return NextResponse.json({ error: error.message, details: error.details }, { status });
    }
    return NextResponse.json({ error: "Failed to dispatch order with Couriers Please" }, { status: 500 });
  }
}
