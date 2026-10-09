export function orderContentsLabel(order: { items: readonly unknown[]; membershipAmount: number }) {
  const count = order.items.length;
  const products = `${count} ${count === 1 ? "item" : "items"}`;
  return order.membershipAmount > 0
    ? count === 0 ? "1 membership" : `${products} + membership`
    : products;
}
