import { moneyToCents } from "./cart-pricing";

/** Preserve the existing store calculation pending merchant approval:
 * merchandise is exclusive of the displayed 10% GST; quoted shipping and the
 * membership fee are final amounts. This is not a tax compliance assessment.
 */
export function checkoutTotals(subtotal: number, shipping: number, membership: number) {
  const merchandiseCents = moneyToCents(subtotal);
  const taxCents = Math.round(merchandiseCents / 10);
  return {
    tax: taxCents / 100,
    total: (merchandiseCents + taxCents + moneyToCents(shipping) + moneyToCents(membership)) / 100,
  };
}
