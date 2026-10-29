-- CreateTable PromotionBanner
CREATE TABLE "PromotionBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "popupImage" TEXT,
    "bannerImage" TEXT,
    "linkUrl" TEXT DEFAULT '/products',
    "linkText" TEXT DEFAULT 'Shop Now',
    "showInPopup" BOOLEAN NOT NULL DEFAULT true,
    "showInBanner" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromotionBanner_isActive_displayOrder_idx" ON "PromotionBanner"("isActive", "displayOrder");
