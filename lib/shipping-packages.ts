import { createHash } from "node:crypto";

export type ShippingItem = {
  key: string;
  quantity: number;
  weight: number | null | undefined;
  length: number | null | undefined;
  width: number | null | undefined;
  height: number | null | undefined;
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
    if (!item.weight || item.weight <= 0 || dimensions.some(value => !value || value <= 0)) {
      throw new FreightRequiredError("This item needs a manual freight quote because its packaged dimensions are unavailable.");
    }
    const [length, width, height] = dimensions as number[];
    const girth = 2 * (width + height);
    const cubicMetres = length * width * height / 1_000_000;
    if (item.weight > 22 || Math.max(length, width, height) > 105 || girth > 140 || cubicMetres > 0.25) {
      throw new FreightRequiredError("This item is outside Australia Post parcel limits and needs a manual freight quote.");
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
