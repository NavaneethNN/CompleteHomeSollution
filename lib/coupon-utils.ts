import { calculateCartPricing, moneyToCents } from "./cart-pricing";

export interface CouponInput {
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maxDiscount: number | null;
}

/** Convenience adapter; all coupon rounding/caps use the authoritative calculator. */
export function calculateCouponDiscount(coupon: CouponInput, applicableSubtotal: number): number {
  if (applicableSubtotal <= 0) return 0;
  return calculateCartPricing([
    { key: "subtotal", quantity: 1, unitPriceCents: moneyToCents(applicableSubtotal), eligible: true },
  ], { type: coupon.discountType, value: coupon.discountValue, maxDiscount: coupon.maxDiscount }).discountCents / 100;
}
