import { randomUUID } from "node:crypto";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getCouriersPleaseTracking,
  type CouriersPleaseTrackingResult,
} from "@/lib/couriersplease";
import { processDueEmailJobs } from "@/lib/email-outbox";

export type CarrierMilestone = "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED";

const STATUS_RANK: Record<string, number> = {
  PAID: 1,
  CONFIRMED: 1,
  PROCESSING: 1,
  SHIPPED: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
};

export const ELIGIBLE_CARRIER_TRANSITION_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
] as const;

/**
 * Ensures carrier webhook/tracking updates only move orders forward in fulfilment.
 * Never reverts OUT_FOR_DELIVERY back to SHIPPED or modifies CANCELLED/REFUNDED/PENDING orders.
 */
export function resolveMonotonicCarrierStatus(
  currentStatus: string,
  targetStatus: CarrierMilestone | null | undefined
): CarrierMilestone | null {
  if (!targetStatus) return null;
  if (
    !ELIGIBLE_CARRIER_TRANSITION_STATUSES.includes(
      currentStatus as (typeof ELIGIBLE_CARRIER_TRANSITION_STATUSES)[number]
    )
  ) {
    return null;
  }
  const currentRank = STATUS_RANK[currentStatus] ?? 0;
  const targetRank = STATUS_RANK[targetStatus] ?? 0;
  return targetRank > currentRank ? targetStatus : null;
}

export async function syncOrderWithCouriersPlease(
  order: {
    id: string;
    status: string;
    trackingNumber: string | null;
    carrier: string | null;
  },
  options?: { sendEmailsImmediately?: boolean }
): Promise<{
  updated: boolean;
  previousStatus: string;
  orderStatus: string;
  tracking: CouriersPleaseTrackingResult | null;
}> {
  if (!order.trackingNumber) {
    return {
      updated: false,
      previousStatus: order.status,
      orderStatus: order.status,
      tracking: null,
    };
  }

  const tracking = await getCouriersPleaseTracking(order.trackingNumber);
  const candidateStatus: CarrierMilestone | null = tracking?.isDelivered
    ? "DELIVERED"
    : tracking?.normalizedStatus ?? null;

  const nextStatus = resolveMonotonicCarrierStatus(order.status, candidateStatus);
  if (!nextStatus) {
    return {
      updated: false,
      previousStatus: order.status,
      orderStatus: order.status,
      tracking,
    };
  }

  const changedCount = await db.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: {
        id: order.id,
        status: order.status as OrderStatus,
      },
      data: {
        status: nextStatus,
        updatedAt: new Date(),
      },
    });

    if (res.count > 0) {
      await tx.emailJob.createMany({
        data: [
          {
            key: `order:${order.id}:status:${nextStatus}:${randomUUID()}`,
            kind: "ORDER_STATUS",
            orderId: order.id,
            payload: {
              status: nextStatus,
              previousStatus: order.status,
              trackingNumber: order.trackingNumber || undefined,
              carrier: order.carrier || "Couriers Please",
            },
          },
        ],
        skipDuplicates: true,
      });
    }

    return res.count;
  });

  const updated = changedCount > 0;
  if (updated && options?.sendEmailsImmediately !== false) {
    await processDueEmailJobs().catch((err) => {
      console.error("[CouriersPlease Sync] Email dispatch error:", err);
    });
  }

  return {
    updated,
    previousStatus: order.status,
    orderStatus: updated ? nextStatus : order.status,
    tracking,
  };
}

export async function syncActiveCouriersPleaseOrders(limit = 25): Promise<{
  checked: number;
  updated: number;
  results: Array<{ orderId: string; previousStatus: string; orderStatus: string; updated: boolean }>;
}> {
  const candidates = await db.order.findMany({
    where: {
      status: { in: ["SHIPPED", "OUT_FOR_DELIVERY"] },
      trackingNumber: { not: null },
      NOT: { trackingNumber: { startsWith: "CPTEST-" } },
      carrier: { contains: "Couriers Please", mode: "insensitive" },
    },
    orderBy: [{ updatedAt: "asc" }],
    take: Math.min(50, Math.max(1, limit)),
    select: {
      id: true,
      status: true,
      trackingNumber: true,
      carrier: true,
    },
  });

  const results: Array<{ orderId: string; previousStatus: string; orderStatus: string; updated: boolean }> = [];
  let updatedCount = 0;

  for (let i = 0; i < candidates.length; i += 4) {
    const batch = candidates.slice(i, i + 4);
    const synced = await Promise.all(
      batch.map(async (order) => {
        try {
          const outcome = await syncOrderWithCouriersPlease(order, { sendEmailsImmediately: false });
          if (outcome.updated) updatedCount++;
          return {
            orderId: order.id,
            previousStatus: outcome.previousStatus,
            orderStatus: outcome.orderStatus,
            updated: outcome.updated,
          };
        } catch (err) {
          console.error("[CouriersPlease Cron Sync] Order error:", { orderId: order.id, err });
          return {
            orderId: order.id,
            previousStatus: order.status,
            orderStatus: order.status,
            updated: false,
          };
        }
      })
    );
    results.push(...synced);
  }

  if (updatedCount > 0) {
    await processDueEmailJobs().catch((err) => {
      console.error("[CouriersPlease Cron Sync] Outbox dispatch error:", err);
    });
  }

  return {
    checked: results.length,
    updated: updatedCount,
    results,
  };
}
