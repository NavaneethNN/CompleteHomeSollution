/** Payment and refund transitions belong to provider-verified handlers. */
export const ADMIN_FULFILMENT_STATUSES = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: [],
  // The fulfilment team may update an already-paid order at the actual stage
  // reached by the manual shipping process. Payment, cancellation and refunds
  // remain outside this admin control.
  PAID: ADMIN_FULFILMENT_STATUSES,
  CONFIRMED: ADMIN_FULFILMENT_STATUSES,
  PROCESSING: ADMIN_FULFILMENT_STATUSES,
  SHIPPED: ADMIN_FULFILMENT_STATUSES,
  OUT_FOR_DELIVERY: ADMIN_FULFILMENT_STATUSES,
  DELIVERED: [], CANCELLED: [], REFUNDED: [],
};
