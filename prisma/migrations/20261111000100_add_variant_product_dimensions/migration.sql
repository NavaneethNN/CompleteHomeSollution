-- Add separate customer-visible product dimensions to ProductVariant
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "productLength" DOUBLE PRECISION;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "productWidth" DOUBLE PRECISION;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "productHeight" DOUBLE PRECISION;
