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
