-- =============================================================================
-- Complete Home Sollution — Production Migration Script
-- Target Database: Neon PostgreSQL (Production)
-- Safe, Idempotent, and Non-Destructive (Can be run multiple times safely)
-- =============================================================================

-- ─── 1. Custom Enums (Raffle System) ───────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RaffleStatus') THEN
        CREATE TYPE "RaffleStatus" AS ENUM (
            'DRAFT', 'UPCOMING', 'ACTIVE', 'CLOSED', 'DRAW_PENDING',
            'DRAW_COMPLETED', 'WINNER_VERIFICATION', 'COMPLETED', 'PAUSED', 'CANCELLED'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RafflePrizeType') THEN
        CREATE TYPE "RafflePrizeType" AS ENUM ('FREE_PRODUCT', 'PAID_PRODUCT');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RaffleWinnerStatus') THEN
        CREATE TYPE "RaffleWinnerStatus" AS ENUM ('PENDING_CLAIM', 'CLAIMED', 'EXPIRED', 'REJECTED');
    END IF;
END $$;

-- ─── 2. Product Table Extensions ─────────────────────────────────────────────
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isLargeItem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "requiresPackaging" BOOLEAN DEFAULT true;

-- ─── 3. ProductVariant Table Extensions ──────────────────────────────────────
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "requiresPackaging" BOOLEAN DEFAULT true;

-- ─── 4. Order Table Extensions (Fulfillment, Store Pickup, Packaging) ─────────
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfillmentType" TEXT DEFAULT 'DELIVERY';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickupAppointmentDate" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickupAppointmentTime" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickupStatus" TEXT DEFAULT 'PENDING_SCHEDULE';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickupNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "manualDeliveryNotes" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packagePresetId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packageName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packedWeight" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packedLength" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packedWidth" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packedHeight" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "packageOverride" BOOLEAN DEFAULT false;

-- ─── 5. Manual Delivery Postcodes Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ManualDeliveryPostcode" (
    "id" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "suburb" TEXT,
    "charge" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualDeliveryPostcode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ManualDeliveryPostcode_postcode_key" ON "ManualDeliveryPostcode"("postcode");
CREATE INDEX IF NOT EXISTS "ManualDeliveryPostcode_postcode_idx" ON "ManualDeliveryPostcode"("postcode");
CREATE INDEX IF NOT EXISTS "ManualDeliveryPostcode_isActive_idx" ON "ManualDeliveryPostcode"("isActive");

-- ─── 6. Packaging Presets Table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PackagingPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "maxWeight" DOUBLE PRECISION NOT NULL,
    "emptyWeight" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackagingPreset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PackagingPreset_isActive_idx" ON "PackagingPreset"("isActive");
CREATE INDEX IF NOT EXISTS "PackagingPreset_priority_idx" ON "PackagingPreset"("priority");

-- ─── 7. Default Packaging Presets Seed Data ──────────────────────────────────
INSERT INTO "PackagingPreset" ("id", "name", "length", "width", "height", "maxWeight", "emptyWeight", "isActive", "priority", "updatedAt")
VALUES
    ('preset_small', 'Small Carton Box', 35, 25, 15, 5, 0.35, true, 10, CURRENT_TIMESTAMP),
    ('preset_medium', 'Medium Carton Box', 45, 35, 25, 12, 0.65, true, 20, CURRENT_TIMESTAMP),
    ('preset_large', 'Large Heavy-Duty Box', 60, 45, 35, 25, 1.10, true, 30, CURRENT_TIMESTAMP),
    ('preset_xlarge', 'Extra Large Furniture Box', 80, 60, 50, 40, 2.20, true, 40, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- ─── 8. Raffle Tables ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Raffle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT NOT NULL,
    "bannerImage" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "RaffleStatus" NOT NULL DEFAULT 'DRAFT',
    "entryPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'ALL',
    "eligiblePlanIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxEntriesPerUser" INTEGER NOT NULL DEFAULT 1,
    "minEntriesPerUser" INTEGER NOT NULL DEFAULT 1,
    "totalMaxEntries" INTEGER,
    "allowMultipleEntries" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "drawDate" TIMESTAMP(3) NOT NULL,
    "automaticClosure" BOOLEAN NOT NULL DEFAULT true,
    "terms" TEXT,
    "ageRestriction" INTEGER,
    "geographicRestriction" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "displayOnHomepage" BOOLEAN NOT NULL DEFAULT false,
    "totalParticipants" INTEGER NOT NULL DEFAULT 0,
    "totalTickets" INTEGER NOT NULL DEFAULT 0,
    "winnersAnnounced" BOOLEAN NOT NULL DEFAULT false,
    "drawSeed" TEXT,
    "drawNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Raffle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Raffle_slug_key" ON "Raffle"("slug");
CREATE INDEX IF NOT EXISTS "Raffle_status_idx" ON "Raffle"("status");
CREATE INDEX IF NOT EXISTS "Raffle_isFeatured_idx" ON "Raffle"("isFeatured");
CREATE INDEX IF NOT EXISTS "Raffle_displayOnHomepage_idx" ON "Raffle"("displayOnHomepage");
CREATE INDEX IF NOT EXISTS "Raffle_startDate_endDate_idx" ON "Raffle"("startDate", "endDate");

CREATE TABLE IF NOT EXISTS "RafflePrize" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prizeType" "RafflePrizeType" NOT NULL DEFAULT 'FREE_PRODUCT',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "productId" TEXT,
    "productVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafflePrize_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RafflePrize_raffleId_idx" ON "RafflePrize"("raffleId");
CREATE INDEX IF NOT EXISTS "RafflePrize_productId_idx" ON "RafflePrize"("productId");
CREATE INDEX IF NOT EXISTS "RafflePrize_productVariantId_idx" ON "RafflePrize"("productVariantId");

CREATE TABLE IF NOT EXISTS "RaffleEntry" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketCount" INTEGER NOT NULL DEFAULT 1,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'FREE',
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RaffleEntry_raffleId_userId_idx" ON "RaffleEntry"("raffleId", "userId");
CREATE INDEX IF NOT EXISTS "RaffleEntry_userId_idx" ON "RaffleEntry"("userId");

CREATE TABLE IF NOT EXISTS "RaffleTicket" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RaffleTicket_ticketNumber_key" ON "RaffleTicket"("ticketNumber");
CREATE INDEX IF NOT EXISTS "RaffleTicket_raffleId_idx" ON "RaffleTicket"("raffleId");
CREATE INDEX IF NOT EXISTS "RaffleTicket_userId_idx" ON "RaffleTicket"("userId");
CREATE INDEX IF NOT EXISTS "RaffleTicket_ticketNumber_idx" ON "RaffleTicket"("ticketNumber");

CREATE TABLE IF NOT EXISTS "RaffleWinner" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "status" "RaffleWinnerStatus" NOT NULL DEFAULT 'PENDING_CLAIM',
    "prizeType" "RafflePrizeType" NOT NULL DEFAULT 'FREE_PRODUCT',
    "winningPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "shippingAddressId" TEXT,
    "shippingAddress" JSONB,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "deliveryStatus" TEXT,
    "claimedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "claimDeadline" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleWinner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RaffleWinner_ticketId_key" ON "RaffleWinner"("ticketId");
CREATE INDEX IF NOT EXISTS "RaffleWinner_raffleId_idx" ON "RaffleWinner"("raffleId");
CREATE INDEX IF NOT EXISTS "RaffleWinner_userId_idx" ON "RaffleWinner"("userId");
CREATE INDEX IF NOT EXISTS "RaffleWinner_status_idx" ON "RaffleWinner"("status");
CREATE INDEX IF NOT EXISTS "RaffleWinner_prizeId_idx" ON "RaffleWinner"("prizeId");

CREATE TABLE IF NOT EXISTS "RaffleAuditLog" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RaffleAuditLog_raffleId_idx" ON "RaffleAuditLog"("raffleId");
CREATE INDEX IF NOT EXISTS "RaffleAuditLog_createdAt_idx" ON "RaffleAuditLog"("createdAt");

-- ─── 9. Foreign Key Constraints (Protected by DO blocks) ─────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RafflePrize_raffleId_fkey') THEN
        ALTER TABLE "RafflePrize" ADD CONSTRAINT "RafflePrize_raffleId_fkey"
            FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RafflePrize_productId_fkey') THEN
        ALTER TABLE "RafflePrize" ADD CONSTRAINT "RafflePrize_productId_fkey"
            FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RafflePrize_productVariantId_fkey') THEN
        ALTER TABLE "RafflePrize" ADD CONSTRAINT "RafflePrize_productVariantId_fkey"
            FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleEntry_raffleId_fkey') THEN
        ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_raffleId_fkey"
            FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleEntry_userId_fkey') THEN
        ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleTicket_raffleId_fkey') THEN
        ALTER TABLE "RaffleTicket" ADD CONSTRAINT "RaffleTicket_raffleId_fkey"
            FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleTicket_entryId_fkey') THEN
        ALTER TABLE "RaffleTicket" ADD CONSTRAINT "RaffleTicket_entryId_fkey"
            FOREIGN KEY ("entryId") REFERENCES "RaffleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleTicket_userId_fkey') THEN
        ALTER TABLE "RaffleTicket" ADD CONSTRAINT "RaffleTicket_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleWinner_raffleId_fkey') THEN
        ALTER TABLE "RaffleWinner" ADD CONSTRAINT "RaffleWinner_raffleId_fkey"
            FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleWinner_prizeId_fkey') THEN
        ALTER TABLE "RaffleWinner" ADD CONSTRAINT "RaffleWinner_prizeId_fkey"
            FOREIGN KEY ("prizeId") REFERENCES "RafflePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleWinner_ticketId_fkey') THEN
        ALTER TABLE "RaffleWinner" ADD CONSTRAINT "RaffleWinner_ticketId_fkey"
            FOREIGN KEY ("ticketId") REFERENCES "RaffleTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleWinner_userId_fkey') THEN
        ALTER TABLE "RaffleWinner" ADD CONSTRAINT "RaffleWinner_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleWinner_orderId_fkey') THEN
        ALTER TABLE "RaffleWinner" ADD CONSTRAINT "RaffleWinner_orderId_fkey"
            FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaffleAuditLog_raffleId_fkey') THEN
        ALTER TABLE "RaffleAuditLog" ADD CONSTRAINT "RaffleAuditLog_raffleId_fkey"
            FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
