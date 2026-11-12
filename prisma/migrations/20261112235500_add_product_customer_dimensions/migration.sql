-- Add customer-visible product dimensions to Product table
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productLength" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productWidth" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productHeight" DOUBLE PRECISION;
