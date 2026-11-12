import { createHash } from "node:crypto";
import {
  parseExtraPackages,
  resolveCourierPackageSet,
  type CourierDimensionProduct,
  type CourierDimensionVariant,
} from "@/lib/variant-dimensions";

export interface PackagingSummary {
  presetId?: string | null;
  packageName: string;
  length: number;
  width: number;
  height: number;
  productWeight: number;
  emptyWeight: number;
  packedWeight: number;
  fitsInPreset: boolean;
  availablePresetsCount: number;
  isAutoEstimated?: boolean;
}

export type ShippingPackageDimension = {
  weight: number | null | undefined;
  length: number | null | undefined;
  width: number | null | undefined;
  height: number | null | undefined;
};

export type ShippingItem = {
  key: string;
  quantity: number;
  weight: number | null | undefined;
  length: number | null | undefined;
  width: number | null | undefined;
  height: number | null | undefined;
  requiresPackaging?: boolean | null;
  extraPackages?: ShippingPackageDimension[] | null;
  label?: string;
};

export type ParcelGroup = {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  count: number;
};

export type PackedBoxSpec = {
  label: string;
  quantity: number;
  length: number;
  width: number;
  height: number;
  weight: number;
};

export class FreightRequiredError extends Error {}

function roundWeightKg(weight: number): number {
  return Math.round(weight * 1000) / 1000;
}

function roundDimCm(dim: number): number {
  return Math.round(dim * 10) / 10;
}

function validateAndNormalizeBox(
  box: ShippingPackageDimension,
  missingMessage: string
): { weightKg: number; lengthCm: number; widthCm: number; heightCm: number } {
  const dimensions = [box.length, box.width, box.height];
  if (
    !box.weight ||
    !Number.isFinite(box.weight) ||
    box.weight <= 0 ||
    dimensions.some((value) => !value || !Number.isFinite(value) || value <= 0)
  ) {
    throw new FreightRequiredError(missingMessage);
  }
  const [length, width, height] = dimensions as number[];
  if (box.weight > 1000 || Math.max(length, width, height) > 1000) {
    throw new FreightRequiredError(
      "This item is outside automatic shipping quote limits and needs a manual freight quote."
    );
  }
  return {
    weightKg: roundWeightKg(box.weight),
    lengthCm: roundDimCm(length),
    widthCm: roundDimCm(width),
    heightCm: roundDimCm(height),
  };
}

function validateItemQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
    throw new FreightRequiredError("Invalid shipment quantity.");
  }
}

function addParcelGroup(
  groups: Map<string, ParcelGroup>,
  parcel: ParcelGroup
): void {
  const key = `${parcel.weightKg}:${parcel.lengthCm}:${parcel.widthCm}:${parcel.heightCm}`;
  const existing = groups.get(key);
  if (existing) {
    existing.count += parcel.count;
  } else {
    groups.set(key, { ...parcel });
  }
}

function sortParcelGroups(groups: Iterable<ParcelGroup>): ParcelGroup[] {
  return [...groups].sort(
    (a, b) =>
      a.weightKg - b.weightKg ||
      a.lengthCm - b.lengthCm ||
      a.widthCm - b.widthCm ||
      a.heightCm - b.heightCm
  );
}

/**
 * Expands each product item into separate physical parcel groups across every
 * product unit and every configured packaging box (primary + extra boxes).
 * Products are never consolidated into a shared box.
 */
export function buildParcelGroups(items: ShippingItem[]): ParcelGroup[] {
  const groups = new Map<string, ParcelGroup>();

  for (const item of items) {
    validateItemQuantity(item.quantity);
    const missingMsg =
      "This item needs a manual freight quote because its packaged dimensions are unavailable.";

    const primary = validateAndNormalizeBox(
      { weight: item.weight, length: item.length, width: item.width, height: item.height },
      missingMsg
    );
    addParcelGroup(groups, { ...primary, count: item.quantity });

    for (const extra of item.extraPackages ?? []) {
      const box = validateAndNormalizeBox(extra, missingMsg);
      addParcelGroup(groups, { ...box, count: item.quantity });
    }
  }

  return sortParcelGroups(groups.values());
}

export function shipmentKey(groups: ParcelGroup[]): string {
  return createHash("sha256").update(JSON.stringify(groups)).digest("base64url");
}

/**
 * Computes separate courier parcel boxes per product unit without ever packing
 * multiple products or multiple quantities together into a shared box.
 * Single-box products with `requiresPackaging !== false` may still be wrapped
 * individually into a matching packaging preset if one fits cleanly; multi-box
 * products (`extraPackages`) book each configured box directly.
/**
 * Builds separate physical parcel groups across every product unit and every
 * configured packaging box (primary + extraPackages). Each item/box is always
 * quoted and shipped in its own configured box(es) without auto-box consolidation.
 */
export async function buildPackagedParcelGroups(
  items: ShippingItem[],
  _legacyPresets?: unknown[]
): Promise<{
  groups: ParcelGroup[];
  boxes: PackedBoxSpec[];
  packaging: PackagingSummary | null;
}> {
  const validatedItems = items.map((item) => {
    validateItemQuantity(item.quantity);
    const missingMsg =
      "This item needs a manual freight quote because its packaged dimensions are unavailable.";
    const primary = validateAndNormalizeBox(
      { weight: item.weight, length: item.length, width: item.width, height: item.height },
      missingMsg
    );
    const extras = (item.extraPackages ?? []).map((extra) =>
      validateAndNormalizeBox(extra, missingMsg)
    );
    return { item, primary, extras };
  });

  const groups = new Map<string, ParcelGroup>();
  const boxes: PackedBoxSpec[] = [];
  let totalBoxUnits = 0;

  for (const entry of validatedItems) {
    const { item, primary, extras } = entry;
    const baseLabel = item.label?.trim() || "Product";
    const rawBoxes = [primary, ...extras];

    for (let idx = 0; idx < rawBoxes.length; idx++) {
      const resolved = rawBoxes[idx];
      const boxLabel = rawBoxes.length > 1 ? `${baseLabel} (Box ${idx + 1})` : baseLabel;

      addParcelGroup(groups, { ...resolved, count: item.quantity });
      boxes.push({
        label: boxLabel,
        quantity: item.quantity,
        length: resolved.lengthCm,
        width: resolved.widthCm,
        height: resolved.heightCm,
        weight: resolved.weightKg,
      });
      totalBoxUnits += item.quantity;
    }
  }

  const sortedGroups = sortParcelGroups(groups.values());
  const totalPackedWeight = roundWeightKg(
    boxes.reduce((sum, box) => sum + box.weight * box.quantity, 0)
  );
  const firstBox = boxes[0];

  let packaging: PackagingSummary | null = null;
  if (totalBoxUnits === 1 && firstBox) {
    packaging = {
      presetId: null,
      packageName: firstBox.label || "Direct Parcel",
      length: firstBox.length,
      width: firstBox.width,
      height: firstBox.height,
      productWeight: firstBox.weight,
      emptyWeight: 0,
      packedWeight: firstBox.weight,
      fitsInPreset: false,
      availablePresetsCount: 0,
    };
  } else if (totalBoxUnits > 1 && firstBox) {
    packaging = {
      presetId: null,
      packageName: `${totalBoxUnits} Boxes (Separate Packaging)`,
      length: firstBox.length,
      width: firstBox.width,
      height: firstBox.height,
      productWeight: totalPackedWeight,
      emptyWeight: 0,
      packedWeight: totalPackedWeight,
      fitsInPreset: false,
      availablePresetsCount: 0,
    };
  }

  return { groups: sortedGroups, boxes, packaging };
}

/**
 * Normalizes a stored `packedBoxes` JSON array into valid positive box specs.
 */
export function parseStoredPackedBoxes(raw: unknown): PackedBoxSpec[] {
  if (!Array.isArray(raw)) return [];
  const parsed: PackedBoxSpec[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const length = typeof obj.length === "number" && Number.isFinite(obj.length) && obj.length > 0 ? obj.length : null;
    const width = typeof obj.width === "number" && Number.isFinite(obj.width) && obj.width > 0 ? obj.width : null;
    const height = typeof obj.height === "number" && Number.isFinite(obj.height) && obj.height > 0 ? obj.height : null;
    const weight = typeof obj.weight === "number" && Number.isFinite(obj.weight) && obj.weight > 0 ? obj.weight : null;
    const qty =
      typeof obj.quantity === "number" && Number.isInteger(obj.quantity) && obj.quantity > 0
        ? obj.quantity
        : 1;
    const label = typeof obj.label === "string" && obj.label.trim() ? obj.label.trim() : `Box ${i + 1}`;
    if (length && width && height && weight) {
      parsed.push({
        label,
        quantity: qty,
        length: roundDimCm(length),
        width: roundDimCm(width),
        height: roundDimCm(height),
        weight: roundWeightKg(weight),
      });
    }
  }
  return parsed;
}

export interface OrderBoxResolutionInput {
  packageName?: string | null;
  packedLength?: number | null;
  packedWidth?: number | null;
  packedHeight?: number | null;
  packedWeight?: number | null;
  packageOverride?: boolean | null;
  packedBoxes?: unknown;
  items: Array<{
    id?: string;
    quantity: number;
    product: CourierDimensionProduct & { name?: string | null; sku?: string | null };
    productVariant?: (CourierDimensionVariant & { sku?: string | null }) | null;
  }>;
}

/**
 * Resolves the exact list of separate courier boxes and summary metrics for an admin order.
 * Uses stored `packedBoxes` (or legacy manual `packageOverride`) when present; otherwise expands
 * every order item into separate per-unit & multi-box parcels cleanly without bundling items.
 */
export async function resolveOrderShipmentBoxes(
  order: OrderBoxResolutionInput,
  _legacyPresets?: unknown[]
): Promise<{
  boxes: PackedBoxSpec[];
  packagePresetId: string | null;
  packageName: string;
  packedLength: number;
  packedWidth: number;
  packedHeight: number;
  packedWeight: number;
  totalBoxCount: number;
}> {
  const storedBoxes = parseStoredPackedBoxes(order.packedBoxes);
  if (storedBoxes.length > 0) {
    const totalBoxCount = storedBoxes.reduce((sum, b) => sum + b.quantity, 0);
    const totalWeight = roundWeightKg(storedBoxes.reduce((sum, b) => sum + b.weight * b.quantity, 0));
    const first = storedBoxes[0];
    return {
      boxes: storedBoxes,
      packagePresetId: null,
      packageName:
        order.packageName ||
        (totalBoxCount === 1 ? first.label : `${totalBoxCount} Boxes (Separate Packaging)`),
      packedLength: order.packedLength && totalBoxCount === 1 ? order.packedLength : first.length,
      packedWidth: order.packedWidth && totalBoxCount === 1 ? order.packedWidth : first.width,
      packedHeight: order.packedHeight && totalBoxCount === 1 ? order.packedHeight : first.height,
      packedWeight: totalWeight,
      totalBoxCount,
    };
  }

  if (
    order.packageOverride &&
    order.packedLength &&
    order.packedWidth &&
    order.packedHeight &&
    order.packedWeight
  ) {
    const label = order.packageName || "Standard Box";
    return {
      boxes: [
        {
          label,
          quantity: 1,
          length: order.packedLength,
          width: order.packedWidth,
          height: order.packedHeight,
          weight: order.packedWeight,
        },
      ],
      packagePresetId: null,
      packageName: label,
      packedLength: order.packedLength,
      packedWidth: order.packedWidth,
      packedHeight: order.packedHeight,
      packedWeight: order.packedWeight,
      totalBoxCount: 1,
    };
  }

  if (order.items.length === 0) {
    const fallback: PackedBoxSpec = {
      label: order.packageName || "Standard Package",
      quantity: 1,
      length: order.packedLength || 30,
      width: order.packedWidth || 25,
      height: order.packedHeight || 20,
      weight: order.packedWeight || 1.0,
    };
    return {
      boxes: [fallback],
      packagePresetId: null,
      packageName: fallback.label,
      packedLength: fallback.length,
      packedWidth: fallback.width,
      packedHeight: fallback.height,
      packedWeight: fallback.weight,
      totalBoxCount: 1,
    };
  }

  const shippingItems: ShippingItem[] = order.items.map((item, idx) => {
    const pkg = resolveCourierPackageSet(item.product, item.productVariant);
    return {
      key: item.id || `order-item-${idx}`,
      quantity: Math.max(1, item.quantity || 1),
      weight: pkg.weight && pkg.weight > 0 ? pkg.weight : 0.5,
      length: pkg.length && pkg.length > 0 ? pkg.length : 20,
      width: pkg.width && pkg.width > 0 ? pkg.width : 15,
      height: pkg.height && pkg.height > 0 ? pkg.height : 10,
      requiresPackaging: pkg.requiresPackaging,
      extraPackages: pkg.extraPackages.length > 0 ? pkg.extraPackages : parseExtraPackages(null),
      label: item.product.name || `Item ${idx + 1}`,
    };
  });

  const { boxes, packaging } = await buildPackagedParcelGroups(shippingItems);
  const totalBoxCount = boxes.reduce((sum, b) => sum + b.quantity, 0);
  const totalWeight = roundWeightKg(boxes.reduce((sum, b) => sum + b.weight * b.quantity, 0));
  const first = boxes[0];

  return {
    boxes,
    packagePresetId: packaging?.presetId ?? null,
    packageName: packaging?.packageName || (totalBoxCount > 1 ? `${totalBoxCount} Boxes (Separate Packaging)` : "Direct Parcel"),
    packedLength: first?.length ?? 30,
    packedWidth: first?.width ?? 25,
    packedHeight: first?.height ?? 20,
    packedWeight: totalWeight,
    totalBoxCount,
  };
}
