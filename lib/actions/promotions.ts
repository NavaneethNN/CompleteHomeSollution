"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cacheFetch, cacheDel, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";

export interface PromotionBannerItem {
  id: string;
  title: string;
  subtitle: string | null;
  popupImage: string | null;
  bannerImage: string | null;
  linkUrl: string | null;
  linkText: string | null;
  showInPopup: boolean;
  showInBanner: boolean;
  isActive: boolean;
  displayOrder: number;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const promotionSchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  subtitle: z.string().max(200).optional().nullable(),
  popupImage: z.string().url("Valid image URL required").optional().nullable(),
  bannerImage: z.string().url("Valid image URL required").optional().nullable(),
  linkUrl: z.string().max(300).optional().nullable(),
  linkText: z.string().max(50).optional().nullable(),
  showInPopup: z.boolean().default(true),
  showInBanner: z.boolean().default(true),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export type PromotionInput = z.infer<typeof promotionSchema>;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized. Admin access required.");
  }
  return session.user;
}

/**
 * Public storefront: fetch all active promotions with Redis caching.
 */
export async function getActivePromotions(): Promise<PromotionBannerItem[]> {
  try {
    return await cacheFetch(
      CACHE_KEYS.promotions,
      CACHE_TTL.promotions,
      async () => {
        const now = new Date();
        const records = await db.promotionBanner.findMany({
          where: {
            isActive: true,
            OR: [
              { startDate: null, endDate: null },
              { startDate: null, endDate: { gte: now } },
              { startDate: { lte: now }, endDate: null },
              { startDate: { lte: now }, endDate: { gte: now } },
            ],
          },
          orderBy: [
            { displayOrder: "asc" },
            { createdAt: "desc" },
          ],
        });

        return records;
      }
    );
  } catch (error) {
    console.error("[getActivePromotions] Error fetching active promotions:", error);
    // Non-blocking fallback: public pages continue rendering if db is temporarily offline
    return [];
  }
}

/**
 * Admin: fetch all promotions (including drafts / inactive).
 */
export async function getAllPromotions(): Promise<PromotionBannerItem[]> {
  await requireAdmin();
  try {
    return await db.promotionBanner.findMany({
      orderBy: [
        { displayOrder: "asc" },
        { createdAt: "desc" },
      ],
    });
  } catch (error) {
    console.error("[getAllPromotions] Error:", error);
    return [];
  }
}

/**
 * Admin: create a new promotional banner/poster.
 */
export async function createPromotion(data: PromotionInput) {
  await requireAdmin();
  const validated = promotionSchema.parse(data);

  if (!validated.popupImage && !validated.bannerImage) {
    throw new Error("Please provide at least a popup poster image or a banner image.");
  }

  const created = await db.promotionBanner.create({
    data: {
      title: validated.title,
      subtitle: validated.subtitle || null,
      popupImage: validated.popupImage || null,
      bannerImage: validated.bannerImage || null,
      linkUrl: validated.linkUrl || "/products",
      linkText: validated.linkText || "Shop Now",
      showInPopup: validated.showInPopup,
      showInBanner: validated.showInBanner,
      isActive: validated.isActive,
      displayOrder: validated.displayOrder,
      startDate: validated.startDate ? new Date(validated.startDate) : null,
      endDate: validated.endDate ? new Date(validated.endDate) : null,
    },
  });

  await cacheDel([CACHE_KEYS.promotions]);
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin/promotions");

  return { success: true, data: created };
}

/**
 * Admin: update existing promotion banner.
 */
export async function updatePromotion(id: string, data: Partial<PromotionInput>) {
  await requireAdmin();

  const existing = await db.promotionBanner.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Promotion poster not found.");
  }

  const merged = {
    title: data.title ?? existing.title,
    subtitle: data.subtitle !== undefined ? data.subtitle : existing.subtitle,
    popupImage: data.popupImage !== undefined ? data.popupImage : existing.popupImage,
    bannerImage: data.bannerImage !== undefined ? data.bannerImage : existing.bannerImage,
    linkUrl: data.linkUrl !== undefined ? data.linkUrl : existing.linkUrl,
    linkText: data.linkText !== undefined ? data.linkText : existing.linkText,
    showInPopup: data.showInPopup ?? existing.showInPopup,
    showInBanner: data.showInBanner ?? existing.showInBanner,
    isActive: data.isActive ?? existing.isActive,
    displayOrder: data.displayOrder ?? existing.displayOrder,
    startDate: data.startDate !== undefined ? data.startDate : existing.startDate?.toISOString(),
    endDate: data.endDate !== undefined ? data.endDate : existing.endDate?.toISOString(),
  };

  const validated = promotionSchema.parse(merged);

  const updated = await db.promotionBanner.update({
    where: { id },
    data: {
      title: validated.title,
      subtitle: validated.subtitle || null,
      popupImage: validated.popupImage || null,
      bannerImage: validated.bannerImage || null,
      linkUrl: validated.linkUrl || "/products",
      linkText: validated.linkText || "Shop Now",
      showInPopup: validated.showInPopup,
      showInBanner: validated.showInBanner,
      isActive: validated.isActive,
      displayOrder: validated.displayOrder,
      startDate: validated.startDate ? new Date(validated.startDate) : null,
      endDate: validated.endDate ? new Date(validated.endDate) : null,
    },
  });

  await cacheDel([CACHE_KEYS.promotions]);
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin/promotions");

  return { success: true, data: updated };
}

/**
 * Admin: toggle promotion active state quickly.
 */
export async function togglePromotionActive(id: string, isActive: boolean) {
  await requireAdmin();

  const updated = await db.promotionBanner.update({
    where: { id },
    data: { isActive },
  });

  await cacheDel([CACHE_KEYS.promotions]);
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin/promotions");

  return { success: true, data: updated };
}

/**
 * Admin: delete promotion banner.
 */
export async function deletePromotion(id: string) {
  await requireAdmin();

  await db.promotionBanner.delete({
    where: { id },
  });

  await cacheDel([CACHE_KEYS.promotions]);
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin/promotions");

  return { success: true };
}
