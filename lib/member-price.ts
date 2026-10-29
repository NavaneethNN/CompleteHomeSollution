/**
 * Resolves member price:
 * 1. If manual member price is uploaded (variant or product level), use it.
 * 2. If not uploaded/set, apply standard member benefit: 5% discount up to a maximum discount of $30.
 */
export function resolveMemberPrice(
  regularPrice: number,
  variantMemberPrice?: number | null,
  productMemberPrice?: number | null
): number | null {
  const manual = variantMemberPrice ?? productMemberPrice;
  if (manual != null && manual > 0 && manual < regularPrice) {
    return Math.round(manual * 100) / 100;
  }
  if (regularPrice > 0) {
    // 5% discount up to max $30 discount
    const discount = Math.min(Math.round(regularPrice * 0.05 * 100) / 100, 30);
    const calculated = Math.round((regularPrice - discount) * 100) / 100;
    return calculated < regularPrice && calculated > 0 ? calculated : null;
  }
  return null;
}
