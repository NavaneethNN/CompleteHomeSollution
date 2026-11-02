"use server";

import { db } from "@/lib/db";
import { verifyGuestOrderToken, createGuestOrderToken } from "@/lib/order-access";
import type { OrderWithItems } from "@/lib/actions/orders";

/**
 * Shared include query for orders
 */
const guestOrderInclude = {
  address: {
    select: {
      name: true,
      phone: true,
      line1: true,
      line2: true,
      suburb: true,
      state: true,
      postcode: true,
      country: true,
    },
  },
  items: {
    include: {
      product: {
        select: { id: true, name: true, slug: true, images: true, categoryId: true },
      },
      productVariant: {
        include: {
          images: { orderBy: { displayOrder: "asc" as const } },
          values: {
            include: {
              variantValue: {
                include: { variantAttribute: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Claims any guest orders that match the given user email and links them to the user's account.
 * Also links any unassigned addresses associated with those orders to the user.
 * 
 * Works for both Google OAuth and Email/Password logins.
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

    console.log(`[claimGuestOrdersForUser] Successfully linked ${guestOrders.length} guest order(s) to user ${userId} (${normalizedEmail})`);
    return guestOrders.length;
  } catch (error) {
    console.error("[claimGuestOrdersForUser] Error linking guest orders:", error);
    return 0;
  }
}

export interface SessionGuestOrderToken {
  orderId: string;
  guestToken: string;
}

/**
 * Retrieves full order details for orders matching valid guest session tokens.
 * Only orders whose cryptographic HMAC token is strictly verified are returned.
 */
export async function getGuestSessionOrders(
  tokens: SessionGuestOrderToken[]
): Promise<{ orders: OrderWithItems[]; error?: string }> {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return { orders: [] };
  }

  // Deduplicate order IDs (cap at 20 most recent to prevent abuse)
  const tokenMap = new Map<string, string>();
  for (const item of tokens.slice(-20)) {
    if (item?.orderId && item?.guestToken) {
      tokenMap.set(item.orderId, item.guestToken);
    }
  }

  const orderIds = Array.from(tokenMap.keys());
  if (orderIds.length === 0) return { orders: [] };

  try {
    const rawOrders = await db.order.findMany({
      where: {
        id: { in: orderIds },
      },
      include: guestOrderInclude,
      orderBy: { createdAt: "desc" },
    });

    // Strictly verify cryptographic guest token for each order
    const verifiedOrders: OrderWithItems[] = [];
    for (const order of rawOrders) {
      const providedToken = tokenMap.get(order.id);
      if (!providedToken) continue;

      // If order was already claimed into an account, allow token holder to view it if token matches guestEmail
      const isAuthorized = verifyGuestOrderToken(order.id, order.guestEmail, providedToken);
      if (isAuthorized) {
        verifiedOrders.push(order as unknown as OrderWithItems);
      }
    }

    return { orders: verifiedOrders };
  } catch (error) {
    console.error("[getGuestSessionOrders] Error fetching session orders:", error);
    return { orders: [], error: "Failed to load session orders" };
  }
}

/**
 * Looks up a guest order by order ID (or last 8 characters) and customer email.
 * Returns the order and generates a valid guest access token if verified.
 */
export async function lookupGuestOrder(
  orderIdQuery: string,
  emailQuery: string
): Promise<{
  success: boolean;
  order?: OrderWithItems;
  guestToken?: string;
  error?: string;
}> {
  const cleanOrderId = orderIdQuery?.trim().replace(/^#/, "");
  const cleanEmail = emailQuery?.trim().toLowerCase();

  if (!cleanOrderId || cleanOrderId.length < 4) {
    return { success: false, error: "Please enter a valid Order Number (e.g. #ABC12345)." };
  }

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  try {
    // Search by full ID or last characters (short ID is usually 8 chars uppercase)
    const order = await db.order.findFirst({
      where: {
        guestEmail: { equals: cleanEmail, mode: "insensitive" },
        OR: [
          { id: cleanOrderId },
          { id: { endsWith: cleanOrderId.toLowerCase() } },
          { id: { endsWith: cleanOrderId.toUpperCase() } },
        ],
      },
      include: guestOrderInclude,
    });

    if (!order) {
      return {
        success: false,
        error: "No matching order found. Please check your Order Number and Email Address and try again.",
      };
    }

    const guestToken = order.guestEmail ? createGuestOrderToken(order.id, order.guestEmail) : undefined;

    return {
      success: true,
      order: order as unknown as OrderWithItems,
      guestToken,
    };
  } catch (error) {
    console.error("[lookupGuestOrder] Error looking up guest order:", error);
    return {
      success: false,
      error: "Something went wrong looking up your order. Please try again.",
    };
  }
}
