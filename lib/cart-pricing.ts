export type PriceLine = {
  key: string;
  unitPriceCents: number;
  quantity: number;
  eligible: boolean;
};

export type DiscountRule = {
  type: "PERCENTAGE" | "FIXED";
  value: number;
  maxDiscount?: number | null;
};

export function moneyToCents(value: number): number {
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid monetary value");
  return cents;
}

export function calculateCartPricing(lines: PriceLine[], discount?: DiscountRule | null) {
  if (lines.some(line => !line.key || !Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0 || !Number.isInteger(line.quantity) || line.quantity <= 0)) {
    throw new Error("Invalid price line");
  }
  const grossByLine = lines.map(line => line.unitPriceCents * line.quantity);
  const grossSubtotalCents = grossByLine.reduce((sum, value) => sum + value, 0);
  const applicableSubtotalCents = lines.reduce(
    (sum, line, index) => sum + (line.eligible ? grossByLine[index] : 0),
    0
  );

  let discountCents = 0;
  if (discount && applicableSubtotalCents > 0) {
    discountCents = discount.type === "PERCENTAGE"
      ? Math.round(applicableSubtotalCents * discount.value / 100)
      : moneyToCents(discount.value);
    if (discount.maxDiscount != null) discountCents = Math.min(discountCents, moneyToCents(discount.maxDiscount));
    discountCents = Math.min(discountCents, applicableSubtotalCents);
  }

  const allocations = lines.map((line, index) => {
    if (!line.eligible || discountCents === 0) return { index, floor: 0, remainder: 0 };
    const numerator = discountCents * grossByLine[index];
    return { index, floor: Math.floor(numerator / applicableSubtotalCents), remainder: numerator % applicableSubtotalCents };
  });
  let unallocated = discountCents - allocations.reduce((sum, item) => sum + item.floor, 0);
  for (const item of [...allocations].sort((a, b) => b.remainder - a.remainder || lines[a.index].key.localeCompare(lines[b.index].key))) {
    if (unallocated-- <= 0) break;
    item.floor++;
  }

  const pricedLines = lines.map((line, index) => ({
    ...line,
    grossCents: grossByLine[index],
    discountCents: allocations[index].floor,
    netCents: grossByLine[index] - allocations[index].floor,
  }));
  return {
    grossSubtotalCents,
    applicableSubtotalCents,
    discountCents,
    subtotalCents: grossSubtotalCents - discountCents,
    lines: pricedLines,
  };
}

/** Split a line total into at most two integer-cent unit-price groups. */
export function splitLineForGateway(line: { quantity: number; netCents: number }) {
  const low = Math.floor(line.netCents / line.quantity);
  const highQuantity = line.netCents % line.quantity;
  return [
    ...(highQuantity ? [{ quantity: highQuantity, unitPriceCents: low + 1 }] : []),
    ...(line.quantity - highQuantity ? [{ quantity: line.quantity - highQuantity, unitPriceCents: low }] : []),
  ];
}
