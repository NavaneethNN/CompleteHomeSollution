import type { OrderStatus } from "@prisma/client";

/**
 * Mask customer names for public community displays to prevent customer enumeration,
 * scraping, and social engineering attacks while preserving authentic community engagement.
 */
export function maskWinnerName(name?: string | null): string {
  if (!name || !name.trim()) return "Verified Customer";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const n = parts[0];
    if (n.length <= 2) return `${n[0]}***`;
    return `${n.slice(0, 2)}***`;
  }
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || "";
  return `${first} ${lastInitial}.***`;
}

/**
 * Minimum total purchase amount (in AUD) on physical/eCommerce products
 * required for a customer to be eligible to participate in all store raffles.
 * Membership fees and delivery charges are strictly excluded.
 */
export const RAFFLE_MIN_PRODUCT_SPEND = 99;

/**
 * Order statuses that represent settled/paid customer orders.
 * Pending, cancelled, and fully refunded orders do not count toward spend.
 */
export const SETTLED_ORDER_STATUSES: OrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export interface OrderForSpendCalculation {
  id?: string;
  subtotal: number;
  discount?: number | null;
  membershipAmount?: number | null;
  total?: number | null;
  refundAmount?: number | null;
  items?: Array<{ id?: string; quantity: number; unitPrice: number }>;
}

export interface UserProductSpendSummary {
  totalProductSpend: number;
  hasMinProductSpend: boolean;
  minProductSpendRequired: number;
  remainingSpendRequired: number;
}

/**
 * Calculates net product spend on a single order, excluding any membership fees and shipping.
 * An order with no product items (e.g. digital membership checkout) has $0 product spend.
 */
export function calculateOrderProductSpend(order: OrderForSpendCalculation): number {
  // If order explicitly has empty items array, it was a membership-only or non-product order
  if (order.items && order.items.length === 0) {
    return 0;
  }

  // Calculate gross product value: use items array if populated, otherwise order.subtotal
  const rawProductAmount =
    order.items && order.items.length > 0
      ? order.items.reduce((sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0), 0)
      : (order.subtotal || 0);

  // Exclude discounts applied to products
  const discount = order.discount || 0;
  const netProductSpend = Math.max(0, rawProductAmount - discount);

  // Subtract any refunded amounts on this order
  const refund = order.refundAmount || 0;
  return Math.max(0, Math.round((netProductSpend - refund) * 100) / 100);
}

/**
 * Calculates cumulative product spend across settled orders for a user.
 */
export function calculateTotalProductSpend(orders: OrderForSpendCalculation[]): UserProductSpendSummary {
  const totalCents = orders.reduce((sumCents, order) => {
    const spend = calculateOrderProductSpend(order);
    return sumCents + Math.round(spend * 100);
  }, 0);

  const totalProductSpend = totalCents / 100;
  const hasMinProductSpend = totalProductSpend >= RAFFLE_MIN_PRODUCT_SPEND;
  const remainingSpendRequired = Math.max(
    0,
    Math.round((RAFFLE_MIN_PRODUCT_SPEND - totalProductSpend) * 100) / 100
  );

  return {
    totalProductSpend,
    hasMinProductSpend,
    minProductSpendRequired: RAFFLE_MIN_PRODUCT_SPEND,
    remainingSpendRequired,
  };
}

/**
 * Queries database for user's settled orders and computes their product spend eligibility for raffles.
 */
export async function getUserProductSpend(
  userId: string,
  userEmail?: string | null,
  client?: any
): Promise<UserProductSpendSummary> {
  if (!userId) {
    return {
      totalProductSpend: 0,
      hasMinProductSpend: false,
      minProductSpendRequired: RAFFLE_MIN_PRODUCT_SPEND,
      remainingSpendRequired: RAFFLE_MIN_PRODUCT_SPEND,
    };
  }

  const dbClient = client || (await import("@/lib/db")).db;

  let normalizedEmail = userEmail?.trim().toLowerCase();
  if (!normalizedEmail && dbClient.user?.findUnique) {
    try {
      const u = await dbClient.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (u?.email) normalizedEmail = u.email.trim().toLowerCase();
    } catch {
      // In tests or transactions without user table, proceed with userId
    }
  }

  const orders = await dbClient.order.findMany({
    where: {
      OR: [
        { userId },
        ...(normalizedEmail ? [{ guestEmail: { equals: normalizedEmail, mode: "insensitive" } }] : []),
      ],
      status: { in: SETTLED_ORDER_STATUSES },
    },
    select: {
      id: true,
      subtotal: true,
      discount: true,
      membershipAmount: true,
      total: true,
      refundAmount: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });

  return calculateTotalProductSpend(orders);
}
