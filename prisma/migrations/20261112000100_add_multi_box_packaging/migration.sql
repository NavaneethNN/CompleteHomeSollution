-- Support multiple courier packaging boxes per product/variant and store per-box parcel breakdowns on orders
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "extraPackages" JSONB;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "extraPackages" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packedBoxes" JSONB;
