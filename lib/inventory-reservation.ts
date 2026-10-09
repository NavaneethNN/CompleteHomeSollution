import type { Prisma } from "@prisma/client";

export class InventoryUnavailableError extends Error {
  constructor(readonly productId: string) {
    super("Inventory is already held by another checkout");
  }
}

/**
 * A pending order item is a stock hold. Lock each stock row before counting
 * pending items so competing checkouts cannot both promise the last unit.
 * The hold ends when the order becomes PAID or CANCELLED; settlement still
 * decrements stock under its existing guard.
 */
export async function assertInventoryAvailableForPendingOrder(
  tx: Prisma.TransactionClient,
  items: ReadonlyArray<{ productId: string; variantId?: string; quantity: number }>,
): Promise<void> {
  const sorted = [...items].sort((a, b) =>
    `${a.productId}:${a.variantId ?? ""}`.localeCompare(`${b.productId}:${b.variantId ?? ""}`));
  for (const item of sorted) {
    if (item.variantId) {
      await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${item.variantId} FOR UPDATE`;
      const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { productId: true, stock: true, isActive: true } });
      if (!variant?.isActive || variant.productId !== item.productId) throw new InventoryUnavailableError(item.productId);
      const held = await tx.orderItem.aggregate({
        where: { productVariantId: item.variantId, order: { is: { status: "PENDING" } } },
        _sum: { quantity: true },
      });
      if (variant.stock - (held._sum.quantity ?? 0) < item.quantity) throw new InventoryUnavailableError(item.productId);
    } else {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${item.productId} FOR UPDATE`;
      const product = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true, isActive: true } });
      if (!product?.isActive) throw new InventoryUnavailableError(item.productId);
      const held = await tx.orderItem.aggregate({
        where: { productId: item.productId, productVariantId: null, order: { is: { status: "PENDING" } } },
        _sum: { quantity: true },
      });
      if (product.stock - (held._sum.quantity ?? 0) < item.quantity) throw new InventoryUnavailableError(item.productId);
    }
  }
}
