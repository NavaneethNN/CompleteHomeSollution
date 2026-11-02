import { createHash } from "node:crypto";
import { selectPackagingPreset, type PackagingCalculationResult } from "@/lib/packaging";

export type ShippingItem = {
  key: string;
  quantity: number;
  weight: number | null | undefined;
  length: number | null | undefined;
  width: number | null | undefined;
  height: number | null | undefined;
  requiresPackaging?: boolean | null;
};

export type ParcelGroup = {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  count: number;
};

export class FreightRequiredError extends Error {}

export function buildParcelGroups(items: ShippingItem[]): ParcelGroup[] {
  const groups = new Map<string, ParcelGroup>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
      throw new FreightRequiredError("Invalid shipment quantity.");
    }
    const dimensions = [item.length, item.width, item.height];
    if (!item.weight || !Number.isFinite(item.weight) || item.weight <= 0 ||
        dimensions.some(value => !value || !Number.isFinite(value) || value <= 0)) {
      throw new FreightRequiredError("This item needs a manual freight quote because its packaged dimensions are unavailable.");
    }
    const [length, width, height] = dimensions as number[];
    if (item.weight > 1000 || Math.max(length, width, height) > 1000) {
      throw new FreightRequiredError("This item is outside automatic shipping quote limits and needs a manual freight quote.");
    }
    const parcel = {
      weightKg: Math.round(item.weight * 1000) / 1000,
      lengthCm: Math.round(length * 10) / 10,
      widthCm: Math.round(width * 10) / 10,
      heightCm: Math.round(height * 10) / 10,
      count: item.quantity,
    };
    const key = `${parcel.weightKg}:${parcel.lengthCm}:${parcel.widthCm}:${parcel.heightCm}`;
    const existing = groups.get(key);
    if (existing) existing.count += item.quantity;
    else groups.set(key, parcel);
  }
  return [...groups.values()].sort((a, b) =>
    a.weightKg - b.weightKg || a.lengthCm - b.lengthCm || a.widthCm - b.widthCm || a.heightCm - b.heightCm
  );
}

export function shipmentKey(groups: ParcelGroup[]): string {
  return createHash("sha256").update(JSON.stringify(groups)).digest("base64url");
}

export async function buildPackagedParcelGroups(items: ShippingItem[]): Promise<{
  groups: ParcelGroup[];
  packaging: PackagingCalculationResult | null;
}> {
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
      throw new FreightRequiredError("Invalid shipment quantity.");
    }
    const dimensions = [item.length, item.width, item.height];
    if (
      !item.weight ||
      !Number.isFinite(item.weight) ||
      item.weight <= 0 ||
      dimensions.some((value) => !value || !Number.isFinite(value) || value <= 0)
    ) {
      throw new FreightRequiredError(
        "This item needs a manual freight quote because its packaged dimensions are unavailable."
      );
    }
    const [length, width, height] = dimensions as number[];
    if (item.weight > 1000 || Math.max(length, width, height) > 1000) {
      throw new FreightRequiredError(
        "This item is outside automatic shipping quote limits and needs a manual freight quote."
      );
    }
  }

  const directItems = items.filter((item) => item.requiresPackaging === false);
  const boxedItems = items.filter((item) => item.requiresPackaging !== false);

  // If no items require packaging, use product dimensions directly
  if (boxedItems.length === 0) {
    const groups = buildParcelGroups(items);
    return { groups, packaging: null };
  }

  const packaging = await selectPackagingPreset(boxedItems);
  if (!packaging) {
    // If no packaging box is configured, use the product dimensions for courier directly
    const groups = buildParcelGroups(items);
    return { groups, packaging: null };
  }

  const boxedGroup: ParcelGroup = {
    weightKg: packaging.packedWeight,
    lengthCm: packaging.length,
    widthCm: packaging.width,
    heightCm: packaging.height,
    count: 1,
  };

  const directGroups = directItems.length > 0 ? buildParcelGroups(directItems) : [];
  const groups: ParcelGroup[] = [boxedGroup, ...directGroups].sort((a, b) =>
    a.weightKg - b.weightKg || a.lengthCm - b.lengthCm || a.widthCm - b.widthCm || a.heightCm - b.heightCm
  );

  return { groups, packaging };
}

