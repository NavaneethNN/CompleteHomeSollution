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

  // If no packaging presets are configured in the database, return null
  // so the caller falls back directly to the product's actual dimensions for courier.
  if (!presets || presets.length === 0) {
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

  // If even the largest box is too small, estimate bounding box or use largest
  const fallbackEmptyWeight = largest?.emptyWeight || 0.8;
  const packedWeight = Math.round((totalProductWeight + fallbackEmptyWeight) * 1000) / 1000;

  return {
    presetId: largest?.id && !largest.id.startsWith("default-") ? largest.id : null,
    packageName: largest ? `${largest.name} (Custom / Multi-box)` : "Standard Carton",
    length: largest?.length || Math.max(60, Math.ceil(maxItemDimension)),
    width: largest?.width || 45,
    height: largest?.height || 40,
    productWeight: totalProductWeight,
    emptyWeight: fallbackEmptyWeight,
    packedWeight,
    fitsInPreset: false,
    availablePresetsCount: presets.length,
  };
}

