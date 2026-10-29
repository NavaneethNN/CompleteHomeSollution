-- AlterTable Product
ALTER TABLE "Product"
  ADD COLUMN "bulletTitle" TEXT,
  ADD COLUMN "bulletPoints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable ProductVariant
ALTER TABLE "ProductVariant"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "bulletTitle" TEXT,
  ADD COLUMN "bulletPoints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

