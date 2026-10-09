CREATE TABLE "EmailJob" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimUntil" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailJob_key_key" ON "EmailJob"("key");
CREATE INDEX "EmailJob_status_nextAttemptAt_idx" ON "EmailJob"("status", "nextAttemptAt");
