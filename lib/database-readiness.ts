import { db } from "@/lib/db";

/** Read all scalar columns so an incomplete migration cannot look healthy. */
export async function checkDatabaseReadiness(): Promise<void> {
  await Promise.all([
    db.order.findFirst(),
    db.membershipPayment.findFirst(),
    db.membershipPlan.findFirst(),
    db.coupon.findFirst(),
    db.stockAlert.findFirst(),
    db.emailJob.findFirst(),
  ]);
}
