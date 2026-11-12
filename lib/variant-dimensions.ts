export interface VariantProductDimensionSource {
  productLength?: number | null;
  productWidth?: number | null;
  productHeight?: number | null;
}

export interface VariantCustomerDimensionsDisplay {
  length: number | null;
  width: number | null;
  height: number | null;
  label: string;
  formatted: string;
}

export interface ExtraPackageBox {
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface CourierDimensionProduct {
  isLargeItem?: boolean | null;
  name?: string | null;
  description?: string | null;
  category?: { slug?: string | null; name?: string | null } | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  requiresPackaging?: boolean | null;
  extraPackages?: unknown;
}

export interface CourierDimensionVariant {
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  requiresPackaging?: boolean | null;
  extraPackages?: unknown;
}

export interface ResolvedCourierPackageSet {
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  requiresPackaging: boolean;
  extraPackages: ExtraPackageBox[];
}

function positiveDimension(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return null;
}

/**
 * Safely parses additional packaging boxes from JSON/array column into validated positive boxes.
 */
export function parseExtraPackages(raw: unknown): ExtraPackageBox[] {
  if (!Array.isArray(raw)) return [];
  const boxes: ExtraPackageBox[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const weight = positiveDimension(obj.weight);
    const length = positiveDimension(obj.length);
    const width = positiveDimension(obj.width);
    const height = positiveDimension(obj.height);
    if (weight !== null && length !== null && width !== null && height !== null) {
      boxes.push({ weight, length, width, height });
    }
  }
  return boxes;
}

/**
 * Resolves customer-visible product dimensions for a variant strictly from its
 * product dimension fields (never falling back to courier parcel dimensions or weight).
 */
export function resolveVariantCustomerDimensions(
  variant: VariantProductDimensionSource | null | undefined
): VariantCustomerDimensionsDisplay | null {
  if (!variant) return null;

  const length = positiveDimension(variant.productLength);
  const width = positiveDimension(variant.productWidth);
  const height = positiveDimension(variant.productHeight);

  if (length === null && width === null && height === null) {
    return null;
  }

  if (length !== null && width !== null && height !== null) {
    return {
      length,
      width,
      height,
      label: "Product dimensions (L × W × H)",
      formatted: `${length} × ${width} × ${height} cm`,
    };
  }

  const parts = [
    length !== null ? `Length: ${length} cm` : null,
    width !== null ? `Width: ${width} cm` : null,
    height !== null ? `Height: ${height} cm` : null,
  ].filter((part): part is string => part !== null);

  return {
    length,
    width,
    height,
    label: "Product dimensions",
    formatted: parts.join(" · "),
  };
}

/**
 * Merges a variant's primary courier parcel weight and dimensions onto its parent product
 * strictly from courier fields so shipping/oversize rules ignore customer product dimensions.
 */
export function withVariantCourierDimensions<T extends CourierDimensionProduct>(
  product: T,
  variant: CourierDimensionVariant | null | undefined
): T {
  return {
    ...product,
    weight: variant?.weight ?? product.weight ?? null,
    length: variant?.length ?? product.length ?? null,
    width: variant?.width ?? product.width ?? null,
    height: variant?.height ?? product.height ?? null,
  };
}

/**
 * Resolves the full set of courier parcel boxes (Box 1 + optional extra packaging boxes)
 * for a product and optional selected variant.
 */
export function resolveCourierPackageSet(
  product: CourierDimensionProduct,
  variant?: CourierDimensionVariant | null
): ResolvedCourierPackageSet {
  const variantExtras = parseExtraPackages(variant?.extraPackages);
  const productExtras = parseExtraPackages(product.extraPackages);
  const variantDefinesOwnParcel = Boolean(
    variant &&
      (variant.weight != null ||
        variant.length != null ||
        variant.width != null ||
        variant.height != null ||
        variantExtras.length > 0)
  );

  return {
    weight: variant?.weight ?? product.weight ?? null,
    length: variant?.length ?? product.length ?? null,
    width: variant?.width ?? product.width ?? null,
    height: variant?.height ?? product.height ?? null,
    requiresPackaging: variant?.requiresPackaging ?? product.requiresPackaging ?? true,
    extraPackages: variantDefinesOwnParcel ? variantExtras : productExtras,
  };
}

/**
 * Produces one CourierDimensionProduct record per box of the product/variant so
 * large-item checks inspect every individual box against physical courier parcel limits.
 */
export function expandCourierProductVariantsForLargeCheck<T extends CourierDimensionProduct>(
  product: T,
  variant?: CourierDimensionVariant | null
): T[] {
  const pkg = resolveCourierPackageSet(product, variant);
  const primary: T = {
    ...product,
    weight: pkg.weight,
    length: pkg.length,
    width: pkg.width,
    height: pkg.height,
  };
  if (pkg.extraPackages.length === 0) {
    return [primary];
  }
  return [
    primary,
    ...pkg.extraPackages.map((box) => ({
      ...product,
      weight: box.weight,
      length: box.length,
      width: box.width,
      height: box.height,
    })),
  ];
}
