-- Add per-product member-only delivery options (free delivery or standard fixed delivery charge)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "memberFreeDelivery" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "memberDeliveryCharge" DOUBLE PRECISION;
