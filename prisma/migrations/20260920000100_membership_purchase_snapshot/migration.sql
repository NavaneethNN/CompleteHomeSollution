ALTER TABLE "Order" ADD COLUMN "membershipPlanId" TEXT;
ALTER TABLE "Order" ADD COLUMN "membershipDurationDays" INTEGER;
ALTER TABLE "Order" ADD COLUMN "membershipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MembershipPayment" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "MembershipPayment" ADD COLUMN "previousExpiry" TIMESTAMP(3);
ALTER TABLE "MembershipPayment" ADD COLUMN "refundedAt" TIMESTAMP(3);
-- Snapshot existing pending add-ons using the previous checkout pricing rule.
-- Ambiguous historical payments must be reviewed, never guessed at runtime.
UPDATE "Order" o SET "membershipPlanId" = p.id,
  "membershipDurationDays" = p."durationDays", "membershipAmount" = p.price
FROM "MembershipPlan" p
WHERE o.status = 'PENDING' AND o."userId" IS NOT NULL
  AND p."isDefault" = true AND p."isActive" = true AND p.price > 0
  AND abs(o.total - o.subtotal - o."shippingCost" - o.tax - p.price) < 0.005;

ALTER TABLE "Order" ADD COLUMN "refundAttemptAmount" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "refundAttemptRestoreStock" BOOLEAN;
