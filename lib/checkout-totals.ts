import { moneyToCents } from "./cart-pricing";

/**
 * Merchandise prices are inclusive of 10% GST. Quoted shipping and membership fee are final amounts.
 * No additional GST is added during checkout.
 */
export function checkoutTotals(subtotal: number, shipping: number, membership: number) {
  const merchandiseCents = moneyToCents(subtotal);
  return {
    tax: 0,
    total: (merchandiseCents + moneyToCents(shipping) + moneyToCents(membership)) / 100,
  };
}
