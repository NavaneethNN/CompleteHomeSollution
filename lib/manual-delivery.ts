import { db } from "@/lib/db";

export interface ProductDeliveryDimensions {
  isLargeItem?: boolean | null;
  name?: string | null;
  description?: string | null;
  category?: { slug?: string | null; name?: string | null } | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
}

/**
 * Checks if a product is considered a "large item" (such as a sofa)
 * that cannot be safely or economically shipped via standard CouriersPlease parcels.
 * These items require either Store Pickup or manual delivery scheduled by store admin.
 */
export function isLargeProduct(product: ProductDeliveryDimensions): boolean {
  if (product.isLargeItem) return true;

  const nameLower = (product.name || "").toLowerCase();
  const descLower = (product.description || "").toLowerCase();
  const catSlugLower = (product.category?.slug || "").toLowerCase();

  // Keyword check for bulky furniture / sofas
  const isSofa =
    nameLower.includes("sofa") ||
    descLower.includes("sofa") ||
    catSlugLower.includes("sofa") ||
    nameLower.includes("couch") ||
    nameLower.includes("sectional") ||
    nameLower.includes("recliner");

  if (isSofa) return true;

  // Courier limits: 25kg physical parcel limit, 180cm maximum dimension
  const weight = product.weight ?? 0;
  const maxDimension = Math.max(product.length ?? 0, product.width ?? 0, product.height ?? 0);

  if (weight > 25 || maxDimension > 180) {
    return true;
  }

  return false;
}

/**
 * Checks if a list of cart items contains at least one large item.
 */
export function hasLargeItemsInCart(items: Array<{ product: ProductDeliveryDimensions }>): boolean {
  return items.some((item) => isLargeProduct(item.product));
}

/**
 * Looks up if an Australian postcode is covered by the admin's manual delivery service.
 */
export async function getManualDeliveryPostcodeRate(
  postcode: string
): Promise<{ available: boolean; charge: number; suburb?: string | null; id?: string } | null> {
  const cleanPostcode = (postcode || "").trim().replace(/\D/g, "").slice(0, 4);
  if (!/^\d{4}$/.test(cleanPostcode)) return null;

  try {
    const record = await db.manualDeliveryPostcode.findUnique({
      where: { postcode: cleanPostcode },
    });

    if (record && record.isActive) {
      return {
        available: true,
        charge: record.charge,
        suburb: record.suburb,
        id: record.id,
      };
    }

    return null;
  } catch (error) {
    console.error("[getManualDeliveryPostcodeRate] DB lookup error:", error);
    return null;
  }
}

