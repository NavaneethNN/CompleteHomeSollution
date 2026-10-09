ALTER TABLE "Order"
  ADD COLUMN "reconciliationNextAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reconciliationLastAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconciliationError" TEXT;

CREATE INDEX "Order_status_reconciliationNextAt_idx" ON "Order"("status", "reconciliationNextAt");
