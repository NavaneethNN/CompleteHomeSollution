-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "requiresPackaging" BOOLEAN DEFAULT true;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "requiresPackaging" BOOLEAN DEFAULT true;

