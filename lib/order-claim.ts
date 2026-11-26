import { db } from "@/lib/db";

/**
 * Claims any guest orders that match the given user email and links them to the user's account.
 * Also links any unassigned addresses associated with those orders to the user.
 *
 * Server-only helper (not a Next.js Server Action) called during sign-in, email verification,
 * and authenticated order queries.
 */
export async function claimGuestOrdersForUser(userId: string, email: string): Promise<number> {
  if (!userId || !email) return 0;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Find all unassigned orders with matching guestEmail (case-insensitive)
    const guestOrders = await db.order.findMany({
      where: {
        userId: null,
        guestEmail: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: { id: true, addressId: true },
    });

    if (guestOrders.length === 0) return 0;

    const orderIds = guestOrders.map((o) => o.id);
    const addressIds = guestOrders.map((o) => o.addressId).filter(Boolean);

    // 2. Link orders to the registered user
    await db.order.updateMany({
      where: { id: { in: orderIds } },
      data: { userId },
    });

    // 3. Link address records to user if they don't have a userId
    if (addressIds.length > 0) {
      await db.address.updateMany({
        where: { id: { in: addressIds }, userId: null },
        data: { userId },
      });
    }

    return guestOrders.length;
  } catch (error) {
    console.error("[claimGuestOrdersForUser] Error linking guest orders:", error);
    return 0;
  }
}
