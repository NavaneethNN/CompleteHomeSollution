import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function releaseCouponReservationInTransaction(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<boolean> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { couponId: true, couponReserved: true },
  });
  if (!order?.couponId || !order.couponReserved) return false;
  const released = await tx.order.updateMany({
    where: { id: orderId, couponReserved: true },
    data: { couponReserved: false },
  });
  if (!released.count) return false;
  await tx.coupon.updateMany({
    where: { id: order.couponId, usageCount: { gt: 0 } },
    data: { usageCount: { decrement: 1 } },
  });
  await tx.userCoupon.deleteMany({ where: { orderId } });
  return true;
}

export async function releaseCouponReservation(orderId: string): Promise<boolean> {
  return db.$transaction((tx) => releaseCouponReservationInTransaction(tx, orderId));
}

/**
 * Releases reserved coupons and marks abandoned PENDING orders (> 30 mins) as CANCELLED.
 */
export async function cleanupStalePendingCouponReservations(
  couponId?: string | null,
  userId?: string | null
): Promise<number> {
  if (typeof db.order?.findMany !== "function") return 0;
  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
  const staleOrders = await db.order.findMany({
    where: {
      status: "PENDING",
      couponReserved: true,
      createdAt: { lt: staleCutoff },
      ...(couponId ? { couponId } : {}),
      ...(userId ? { userId } : {}),
    },
    select: { id: true },
  });

  for (const order of staleOrders) {
    await db.$transaction(async (tx) => {
      await releaseCouponReservationInTransaction(tx, order.id);
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
    });
  }

  return staleOrders.length;
}
