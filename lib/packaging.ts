import { db } from "@/lib/db";

export interface PackagingPresetType {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  maxWeight: number;
  emptyWeight: number;
  isActive: boolean;
  priority: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const DEFAULT_PACKAGING_PRESETS = [
  {
    name: "Small",
    length: 20,
    width: 15,
    height: 10,
    maxWeight: 1.0,
    emptyWeight: 0.1,
    priority: 1,
    isActive: true,
  },
  {
    name: "Medium",
    length: 30,
    width: 25,
    height: 20,
    maxWeight: 3.0,
    emptyWeight: 0.2,
    priority: 2,
    isActive: true,
  },
  {
    name: "Large",
    length: 45,
    width: 35,
    height: 30,
    maxWeight: 10.0,
    emptyWeight: 0.5,
    priority: 3,
    isActive: true,
  },
  {
    name: "Extra Large",
    length: 60,
    width: 45,
    height: 40,
    maxWeight: 20.0,
    emptyWeight: 0.8,
    priority: 4,
    isActive: true,
  },
];

export interface PackagingItemInput {
  quantity: number;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  name?: string;
}

export interface PackagingCalculationResult {
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

/**
 * Calculates estimated minimum packaging dimensions and weight required to package multiple items
 * together when no packaging box presets are configured or when items exceed all presets.
 */
export function calculateEstimatedMinimumDimensions(items: PackagingItemInput[]): PackagingCalculationResult {
  let totalProductWeight = 0;
  let totalProductVolume = 0;
  let maxItemL = 0;
  let maxItemW = 0;
  let maxItemH = 0;
  let stackedHeight = 0;
  let totalQuantity = 0;

  for (const item of items) {
    const qty = Math.max(1, item.quantity || 1);
    totalQuantity += qty;

    const w = item.weight && item.weight > 0 ? item.weight : 0.5;
    const rawDims = [
      item.length && item.length > 0 ? item.length : 15,
      item.width && item.width > 0 ? item.width : 10,
      item.height && item.height > 0 ? item.height : 5,
    ].sort((a, b) => b - a); // [L, W, H] where L >= W >= H

    const [l, b, h] = rawDims;

    totalProductWeight += w * qty;
    totalProductVolume += l * b * h * qty;
    stackedHeight += h * qty;

    maxItemL = Math.max(maxItemL, l);
    maxItemW = Math.max(maxItemW, b);
    maxItemH = Math.max(maxItemH, h);
  }

  totalProductWeight = Math.round(totalProductWeight * 1000) / 1000;

  // Packing allowance: 80% packing efficiency (20% void space / protective wrapping)
  const requiredVolume = totalProductVolume * 1.25;

  let boxL = Math.ceil(maxItemL);
  let boxW = Math.ceil(maxItemW);
  let boxH = Math.ceil(Math.max(maxItemH, requiredVolume / (boxL * boxW)));

  // If stacking items makes height disproportionately large (> 1.5x length) and there are multiple items,
  // simulate side-by-side arrangement by expanding width
  if (totalQuantity > 1 && boxH > boxL * 1.5) {
    boxW = Math.ceil(Math.max(boxW * 1.8, Math.sqrt(requiredVolume / boxL)));
    boxH = Math.ceil(Math.max(maxItemH, requiredVolume / (boxL * boxW)));
  }

  boxL = Math.max(Math.ceil(maxItemL), boxL);
  boxW = Math.max(Math.ceil(maxItemW), boxW);
  boxH = Math.max(Math.ceil(maxItemH), boxH);

  if (stackedHeight > 0 && boxH > Math.ceil(stackedHeight * 1.1)) {
    boxH = Math.ceil(stackedHeight * 1.1);
  }

  // Tare weight of estimated carton based on total weight tier
  const emptyWeight =
    totalProductWeight <= 3 ? 0.2 :
    totalProductWeight <= 10 ? 0.4 :
    totalProductWeight <= 20 ? 0.6 : 0.8;

  const packedWeight = Math.round((totalProductWeight + emptyWeight) * 1000) / 1000;

  return {
    presetId: null,
    packageName: totalQuantity > 1 ? "Estimated Minimum Package (Auto-packed)" : "Estimated Minimum Package",
    length: boxL,
    width: boxW,
    height: boxH,
    productWeight: totalProductWeight,
    emptyWeight,
    packedWeight,
    fitsInPreset: false,
    availablePresetsCount: 0,
    isAutoEstimated: true,
  };
}

/**
 * Checks if a single item's 3D dimensions can physically fit inside a box
 * considering 3D rotation (comparing sorted dimensions).
 */
function itemFitsInBox(
  itemDims: [number, number, number],
  boxDims: [number, number, number]
): boolean {
  const sortedItem = [...itemDims].sort((a, b) => a - b);
  const sortedBox = [...boxDims].sort((a, b) => a - b);
  return (
    sortedItem[0] <= sortedBox[0] &&
    sortedItem[1] <= sortedBox[1] &&
    sortedItem[2] <= sortedBox[2]
  );
}

/**
 * Calculates total product weight, assesses physical fit against active packaging presets,
 * and selects the smallest suitable packaging preset.
 * Returns null if no active packaging presets are configured.
 */
export async function selectPackagingPreset(
  items: PackagingItemInput[],
  customPresets?: PackagingPresetType[]
): Promise<PackagingCalculationResult | null> {
  // 1. Fetch active packaging presets from DB if not provided
  let presets = customPresets;
  if (!presets) {
    try {
      presets = await db.packagingPreset.findMany({
        where: { isActive: true },
        orderBy: [{ priority: "desc" }, { maxWeight: "asc" }],
      });
    } catch {
      presets = [];
    }
  }

  // If no packaging presets are configured in the database:
  // - When multiple items need to be shipped (total quantity > 1 or multiple items):
  //   automatically calculate the estimated minimum dimensions required to pack those items into 1 package.
  // - When only a single item is shipped (quantity = 1): return null to use product's own dimensions.
  const totalQuantity = items.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0);
  if (!presets || presets.length === 0) {
    if (totalQuantity > 1) {
      return calculateEstimatedMinimumDimensions(items);
    }
    return null;
  }

  // 2. Calculate cumulative product weight and volume
  let totalProductWeight = 0;
  let totalProductVolume = 0;
  let maxItemDimension = 0;

  for (const item of items) {
    const qty = Math.max(1, item.quantity || 1);
    const w = item.weight && item.weight > 0 ? item.weight : 0.5; // default 500g
    const l = item.length && item.length > 0 ? item.length : 15;
    const b = item.width && item.width > 0 ? item.width : 10;
    const h = item.height && item.height > 0 ? item.height : 5;

    totalProductWeight += w * qty;
    totalProductVolume += l * b * h * qty;
    maxItemDimension = Math.max(maxItemDimension, l, b, h);
  }

  totalProductWeight = Math.round(totalProductWeight * 1000) / 1000;

  // 3. Find candidate presets that satisfy:
  //    a) total product weight <= preset.maxWeight
  //    b) every single item can fit inside the box in at least one orientation
  //    c) total product volume <= box volume * 0.85 (85% packing efficiency)
  const candidates: Array<{
    preset: PackagingPresetType;
    boxVolume: number;
  }> = [];

  for (const preset of presets) {
    if (totalProductWeight > preset.maxWeight) {
      continue;
    }

    const boxDims: [number, number, number] = [preset.length, preset.width, preset.height];
    const boxVolume = preset.length * preset.width * preset.height;

    // Check individual item fit
    let allItemsFit = true;
    for (const item of items) {
      const l = item.length && item.length > 0 ? item.length : 15;
      const b = item.width && item.width > 0 ? item.width : 10;
      const h = item.height && item.height > 0 ? item.height : 5;
      if (!itemFitsInBox([l, b, h], boxDims)) {
        allItemsFit = false;
        break;
      }
    }

    if (!allItemsFit) {
      continue;
    }

    // Volume capacity check with 85% packing efficiency
    if (totalProductVolume > boxVolume * 0.85) {
      continue;
    }

    candidates.push({ preset, boxVolume });
  }

  // 4. If matching candidates found, pick the SMALLEST box volume
  // (if volume is tied, higher priority wins)
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (a.boxVolume !== b.boxVolume) {
        return a.boxVolume - b.boxVolume; // Smallest box volume first
      }
      return b.preset.priority - a.preset.priority; // Higher priority tiebreaker
    });

    const chosen = candidates[0].preset;
    const packedWeight = Math.round((totalProductWeight + chosen.emptyWeight) * 1000) / 1000;

    return {
      presetId: chosen.id.startsWith("default-") ? null : chosen.id,
      packageName: chosen.name,
      length: chosen.length,
      width: chosen.width,
      height: chosen.height,
      productWeight: totalProductWeight,
      emptyWeight: chosen.emptyWeight,
      packedWeight,
      fitsInPreset: true,
      availablePresetsCount: presets.length,
    };
  }

  // 5. Fallback if order exceeds all presets or no preset fits:
  // Sort presets by volume descending to find largest available box
  const sortedPresets = [...presets].sort((a, b) => {
    return (b.length * b.width * b.height) - (a.length * a.width * a.height);
  });
  const largest = sortedPresets[0];

  const estimated = calculateEstimatedMinimumDimensions(items);
  const fallbackEmptyWeight = largest?.emptyWeight || estimated.emptyWeight;
  const packedWeight = Math.round((totalProductWeight + fallbackEmptyWeight) * 1000) / 1000;

  return {
    presetId: largest?.id && !largest.id.startsWith("default-") ? largest.id : null,
    packageName: largest ? `${largest.name} (Custom / Multi-box)` : "Estimated Minimum Package (Auto-packed)",
    length: Math.max(largest?.length || 0, estimated.length),
    width: Math.max(largest?.width || 0, estimated.width),
    height: Math.max(largest?.height || 0, estimated.height),
    productWeight: totalProductWeight,
    emptyWeight: fallbackEmptyWeight,
    packedWeight,
    fitsInPreset: false,
    availablePresetsCount: presets.length,
    isAutoEstimated: true,
  };
}

