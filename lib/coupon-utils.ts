/**
 * Shared coupon discount calculation utility
 * PERF-5: Extracted from duplicated logic in checkout/session, coupons/validate, and checkout-form
 */

export interface CouponInput {
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maxDiscount: number | null;
}

/**
 * Calculate coupon discount amount given an applicable subtotal.
 * @param coupon - Coupon with discountType, discountValue, maxDiscount
 * @param applicableSubtotal - Subtotal of items eligible for this coupon (in dollars)
 * @returns Discount amount in dollars (non-negative, capped by maxDiscount if set)
 */
export function calculateCouponDiscount(
  coupon: CouponInput,
  applicableSubtotal: number
): number {
  if (applicableSubtotal <= 0) return 0;

  let discount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discount = (applicableSubtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount !== null && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else if (coupon.discountType === "FIXED") {
    discount = Math.min(coupon.discountValue, applicableSubtotal);
  }

  return Math.max(0, Math.round(discount * 100) / 100);
}
