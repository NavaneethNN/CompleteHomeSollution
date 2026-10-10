ALTER TABLE "Order"
  ADD COLUMN "shippingServiceCode" TEXT,
  ADD COLUMN "ship123OrderNo" TEXT,
  ADD COLUMN "ship123LabelUrl" TEXT,
  ADD COLUMN "ship123CreateState" TEXT,
  ADD COLUMN "ship123CreateStartedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_ship123OrderNo_key" ON "Order"("ship123OrderNo");
