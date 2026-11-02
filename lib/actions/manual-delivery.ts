"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { processDueEmailJobs } from "@/lib/email-outbox";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    throw new Error("Unauthorized: Admin privileges required.");
  }
  return session.user;
}

const postcodeSchema = z.object({
  postcode: z.string().trim().regex(/^\d{4}$/, "Postcode must be a 4-digit number"),
  suburb: z.string().trim().max(100).optional().nullable(),
  charge: z.number().min(0, "Delivery charge must be positive").max(10000, "Charge exceeds maximum"),
});

export async function getManualDeliveryPostcodes() {
  await requireAdmin();
  return db.manualDeliveryPostcode.findMany({
    orderBy: { postcode: "asc" },
  });
}

export async function createManualDeliveryPostcode(input: {
  postcode: string;
  suburb?: string | null;
  charge: number;
}) {
  await requireAdmin();
  const validated = postcodeSchema.parse(input);

  const existing = await db.manualDeliveryPostcode.findUnique({
    where: { postcode: validated.postcode },
  });

  if (existing) {
    return { success: false, error: `Postcode ${validated.postcode} is already configured.` };
  }

  const created = await db.manualDeliveryPostcode.create({
    data: {
      postcode: validated.postcode,
      suburb: validated.suburb || null,
      charge: Math.round(validated.charge * 100) / 100,
      isActive: true,
    },
  });

  revalidatePath("/admin/delivery");
  return { success: true, postcode: created };
}

export async function updateManualDeliveryPostcode(
  id: string,
  input: {
    charge?: number;
    suburb?: string | null;
    isActive?: boolean;
  }
) {
  await requireAdmin();

  const data: any = {};
  if (input.charge !== undefined) {
    if (input.charge < 0) return { success: false, error: "Charge cannot be negative" };
    data.charge = Math.round(input.charge * 100) / 100;
  }
  if (input.suburb !== undefined) {
    data.suburb = input.suburb ? input.suburb.trim() : null;
  }
  if (input.isActive !== undefined) {
    data.isActive = Boolean(input.isActive);

    // If attempting to deactivate, check for in-flight pending checkout orders
    if (input.isActive === false) {
      const existing = await db.manualDeliveryPostcode.findUnique({
        where: { id },
        select: { postcode: true, isActive: true },
      });
      if (existing && existing.isActive && typeof db.order?.count === "function") {
        const activePendingOrders = await db.order.count({
          where: {
            status: "PENDING",
            fulfillmentType: "MANUAL_DELIVERY",
            address: { postcode: existing.postcode },
            createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
          },
        });
        if (activePendingOrders > 0) {
          return {
            success: false,
            error: `Cannot deactivate postcode ${existing.postcode}: ${activePendingOrders} active pending order(s) are currently awaiting checkout payment.`,
          };
        }
      }
    }
  }

  const updated = await db.manualDeliveryPostcode.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/delivery");
  return { success: true, postcode: updated };
}

export async function deleteManualDeliveryPostcode(id: string) {
  await requireAdmin();

  const existing = await db.manualDeliveryPostcode.findUnique({
    where: { id },
  });

  if (!existing) {
    return { success: false, error: "Postcode record not found" };
  }

  // Prevent deleting postcodes that have active in-flight pending orders
  if (typeof db.order?.count === "function") {
    const activePendingOrders = await db.order.count({
      where: {
        status: "PENDING",
        fulfillmentType: "MANUAL_DELIVERY",
        address: { postcode: existing.postcode },
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
    });

    if (activePendingOrders > 0) {
      return {
        success: false,
        error: `Cannot delete postcode ${existing.postcode}: ${activePendingOrders} active pending order(s) are currently awaiting checkout payment for this zone. Deactivate it instead, or wait for the pending checkout to resolve.`,
      };
    }
  }

  await db.manualDeliveryPostcode.delete({
    where: { id },
  });
  revalidatePath("/admin/delivery");
  return { success: true };
}

/**
 * Updates store pickup appointment information from the Admin Order Detail view.
 */
export async function updateOrderPickupDetails(
  orderId: string,
  input: {
    pickupAppointmentDate?: string | null; // ISO date string YYYY-MM-DD
    pickupAppointmentTime?: string | null; // e.g. "10:30 AM" or "2:00 PM - 4:00 PM"
    pickupStatus?: string | null; // "PENDING_SCHEDULE" | "SCHEDULED" | "READY_FOR_PICKUP" | "PICKED_UP"
    pickupNotes?: string | null;
  }
) {
  await requireAdmin();

  const existingOrder = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, pickupStatus: true, refundRequested: true, refundProcessing: true },
  });

  if (!existingOrder) {
    return { success: false, error: "Order not found." };
  }

  const updateData: any = {};

  if (input.pickupAppointmentDate !== undefined) {
    updateData.pickupAppointmentDate = input.pickupAppointmentDate
      ? new Date(input.pickupAppointmentDate)
      : null;
  }

  if (input.pickupAppointmentTime !== undefined) {
    updateData.pickupAppointmentTime = input.pickupAppointmentTime
      ? input.pickupAppointmentTime.trim()
      : null;
  }

  if (input.pickupStatus !== undefined && input.pickupStatus !== null) {
    updateData.pickupStatus = input.pickupStatus;
    // Guard against completing pickup on unpaid or invalid orders
    if (input.pickupStatus === "PICKED_UP") {
      if (existingOrder.status === "PENDING") {
        return { success: false, error: "Cannot mark pickup as completed on an unpaid PENDING order." };
      }
      if (["CANCELLED", "REFUNDED"].includes(existingOrder.status)) {
        return { success: false, error: `Cannot mark a ${existingOrder.status.toLowerCase()} order as picked up.` };
      }
      if (existingOrder.refundRequested || existingOrder.refundProcessing) {
        return { success: false, error: "Cannot complete pickup while a refund is requested or processing." };
      }
      updateData.status = "DELIVERED";
    } else if (input.pickupStatus === "READY_FOR_PICKUP" && ["PAID", "CONFIRMED"].includes(existingOrder.status)) {
      updateData.status = "PROCESSING";
    }
  }

  if (input.pickupNotes !== undefined) {
    updateData.pickupNotes = input.pickupNotes ? input.pickupNotes.trim() : null;
  }

  const transitionedToDelivered = updateData.status === "DELIVERED" && existingOrder.status !== "DELIVERED";
  const transitionedToProcessing = updateData.status === "PROCESSING" && existingOrder.status !== "PROCESSING";
  const shouldQueueEmail = (transitionedToDelivered || transitionedToProcessing) && typeof db.emailJob?.createMany === "function";

  const updated = await db.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: updateData,
    });

    if (shouldQueueEmail && typeof tx.emailJob?.createMany === "function") {
      const targetStatus = updateData.status;
      await tx.emailJob.createMany({
        data: [{
          key: `order:${orderId}:status:${targetStatus}:${randomUUID()}`,
          kind: "ORDER_STATUS",
          orderId,
          payload: { status: targetStatus, previousStatus: existingOrder.status },
        }],
        skipDuplicates: true,
      });
    }

    return order;
  });

  if (shouldQueueEmail) {
    await processDueEmailJobs().catch((emailErr) => {
      console.error("[updateOrderPickupDetails] Email dispatch note:", emailErr);
    });
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);

  return { success: true, order: updated };
}

