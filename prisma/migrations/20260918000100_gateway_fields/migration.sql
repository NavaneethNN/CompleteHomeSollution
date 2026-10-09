-- Add new provider fields without reclassifying historical Stripe payments.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paywayTransactionId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paywayRefundId" TEXT;
ALTER TABLE "MembershipPayment" ADD COLUMN IF NOT EXISTS "paywaySessionId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "MembershipPayment_paywaySessionId_key" ON "MembershipPayment"("paywaySessionId");
CREATE INDEX IF NOT EXISTS "Order_paywayTransactionId_idx" ON "Order"("paywayTransactionId");
CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");
