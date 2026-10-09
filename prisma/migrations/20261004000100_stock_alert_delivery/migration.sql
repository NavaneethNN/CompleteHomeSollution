ALTER TABLE "StockAlert"
  ADD COLUMN "notifiedAt" TIMESTAMP(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "claimUntil" TIMESTAMP(3),
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" TEXT;

CREATE INDEX "StockAlert_notifiedAt_nextAttemptAt_idx" ON "StockAlert"("notifiedAt", "nextAttemptAt");
