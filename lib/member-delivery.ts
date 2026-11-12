export interface MemberDeliveryProductConfig {
  memberFreeDelivery?: boolean | null;
  memberDeliveryCharge?: number | null;
}

export type MemberDeliveryMode =
  | { type: "STANDARD" }
  | { type: "FREE"; fixedUnitCents: 0 }
  | { type: "FIXED"; fixedUnitCents: number };

export interface MemberDeliveryPartition<T extends { quantity: number }> {
  freeCount: number;
  fixedLineCount: number;
  fixedDeliveryCents: number;
  standardItems: T[];
  hasMemberDeliveryOverride: boolean;
  allOverridden: boolean;
}

export const MEMBER_FREE_DELIVERY_CODE = "MEMBER_FREE_DELIVERY";
export const MEMBER_FIXED_DELIVERY_CODE = "MEMBER_FIXED_DELIVERY";

export function isMemberDeliveryServiceCode(code: string | null | undefined): boolean {
  return code === MEMBER_FREE_DELIVERY_CODE || code === MEMBER_FIXED_DELIVERY_CODE;
}

/**
 * Resolves a product's member-only delivery override. Non-members always
 * receive standard courier/manual delivery calculation.
 */
export function resolveProductMemberDeliveryMode(
  product: MemberDeliveryProductConfig | null | undefined,
  effectiveMember: boolean
): MemberDeliveryMode {
  if (!effectiveMember || !product) {
    return { type: "STANDARD" };
  }
  if (product.memberFreeDelivery === true) {
    return { type: "FREE", fixedUnitCents: 0 };
  }
  if (
    typeof product.memberDeliveryCharge === "number" &&
    Number.isFinite(product.memberDeliveryCharge) &&
    product.memberDeliveryCharge >= 0
  ) {
    return {
      type: "FIXED",
      fixedUnitCents: Math.round(product.memberDeliveryCharge * 100),
    };
  }
  return { type: "STANDARD" };
}

/**
 * Partitions cart line items into member-overridden items (free or fixed price * qty)
 * and remaining standard items whose delivery still needs courier / manual calculation.
 */
export function partitionCartForMemberDelivery<T extends { quantity: number }>(
  items: T[],
  getProductConfig: (item: T) => MemberDeliveryProductConfig | null | undefined,
  effectiveMember: boolean
): MemberDeliveryPartition<T> {
  if (!effectiveMember) {
    return {
      freeCount: 0,
      fixedLineCount: 0,
      fixedDeliveryCents: 0,
      standardItems: items,
      hasMemberDeliveryOverride: false,
      allOverridden: false,
    };
  }

  let freeCount = 0;
  let fixedLineCount = 0;
  let fixedDeliveryCents = 0;
  const standardItems: T[] = [];

  for (const item of items) {
    const mode = resolveProductMemberDeliveryMode(getProductConfig(item), true);
    if (mode.type === "FREE") {
      freeCount += 1;
    } else if (mode.type === "FIXED") {
      fixedLineCount += 1;
      fixedDeliveryCents += mode.fixedUnitCents * item.quantity;
    } else {
      standardItems.push(item);
    }
  }

  const hasMemberDeliveryOverride = freeCount > 0 || fixedLineCount > 0;
  return {
    freeCount,
    fixedLineCount,
    fixedDeliveryCents,
    standardItems,
    hasMemberDeliveryOverride,
    allOverridden: standardItems.length === 0 && items.length > 0,
  };
}

export function memberDeliveryShipmentKey(
  baseShipmentKey: string,
  partition: Pick<MemberDeliveryPartition<{ quantity: number }>, "hasMemberDeliveryOverride" | "fixedDeliveryCents">
): string {
  if (!partition.hasMemberDeliveryOverride) return baseShipmentKey;
  return `${baseShipmentKey}|member:${partition.fixedDeliveryCents}`;
}

export function buildMemberOverriddenShipmentKey(
  items: ReadonlyArray<{ productId: string; variantId?: string | null; quantity: number }>,
  fixedDeliveryCents: number
): string {
  const normalized = items
    .map((item) => `${item.productId}:${item.variantId ?? "base"}x${item.quantity}`)
    .sort()
    .join(",");
  return `MEMBER_OVERRIDE:${fixedDeliveryCents}:${normalized}`;
}
