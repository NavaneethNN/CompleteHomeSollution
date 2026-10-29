-- AlterTable User
ALTER TABLE "User"
  ADD COLUMN "membershipAutoRenew" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "membershipStatus" TEXT,
  ADD COLUMN "membershipCancelReason" TEXT,
  ADD COLUMN "membershipCancelledAt" TIMESTAMP(3),
  ADD COLUMN "membershipRetryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "membershipNextRetryAt" TIMESTAMP(3),
  ADD COLUMN "membershipLastRetryAt" TIMESTAMP(3);

