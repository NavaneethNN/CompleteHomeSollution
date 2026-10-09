-- Migration: add_order_idempotency_key
-- REL-5 fix: Adds a client-generated idempotency key to the Order table.
-- Prevents duplicate orders when a browser retries a slow or failed checkout POST.
-- The column is nullable (existing orders have no key) and has a UNIQUE constraint
-- so two requests with the same key always resolve to the same order row.

-- IF NOT EXISTS makes this safe for databases where the schema was updated
-- manually before Prisma migration history was introduced.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
