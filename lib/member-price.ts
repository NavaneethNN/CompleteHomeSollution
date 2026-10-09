/** A variant without its own member price inherits the product's member price. */
export function resolveMemberPrice(
  regularPrice: number,
  variantMemberPrice: number | null | undefined,
  productMemberPrice: number | null | undefined = null
): number | null {
  const memberPrice = variantMemberPrice ?? productMemberPrice;
  return memberPrice != null && memberPrice > 0 && memberPrice < regularPrice ? memberPrice : null;
}
