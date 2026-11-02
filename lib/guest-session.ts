"use client";

export interface SessionGuestOrder {
  orderId: string;
  guestToken: string;
  email?: string;
  createdAt?: string;
}

const STORAGE_KEY = "chs_guest_orders";
const COOKIE_NAME = "chs_guest_orders";

/**
 * Parses guest orders from sessionStorage and session cookie
 */
export function getGuestOrdersFromSession(): SessionGuestOrder[] {
  if (typeof window === "undefined") return [];

  const ordersMap = new Map<string, SessionGuestOrder>();

  // 1. Try sessionStorage
  try {
    const rawStorage = sessionStorage.getItem(STORAGE_KEY);
    if (rawStorage) {
      const parsed = JSON.parse(rawStorage);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item?.orderId && item?.guestToken) {
            ordersMap.set(item.orderId, item);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[guest-session] Failed to read from sessionStorage:", err);
  }

  // 2. Try session cookie as cross-tab fallback
  try {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const cookie = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (cookie) {
      const val = decodeURIComponent(cookie.substring(COOKIE_NAME.length + 1));
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item?.orderId && item?.guestToken && !ordersMap.has(item.orderId)) {
            ordersMap.set(item.orderId, item);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[guest-session] Failed to read from cookie:", err);
  }

  return Array.from(ordersMap.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

/**
 * Saves a guest order into sessionStorage and session cookie
 */
export function saveGuestOrderToSession(order: SessionGuestOrder): void {
  if (typeof window === "undefined" || !order?.orderId || !order?.guestToken) return;

  try {
    const currentOrders = getGuestOrdersFromSession();
    const updated = [
      {
        orderId: order.orderId,
        guestToken: order.guestToken,
        email: order.email?.toLowerCase().trim() || "",
        createdAt: order.createdAt || new Date().toISOString(),
      },
      ...currentOrders.filter((o) => o.orderId !== order.orderId),
    ].slice(0, 10); // keep up to 10 recent orders

    // Persist to sessionStorage
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Persist to session cookie (omitting Expires/Max-Age makes it a true browser session cookie)
    const jsonVal = encodeURIComponent(JSON.stringify(updated));
    document.cookie = `${COOKIE_NAME}=${jsonVal}; path=/; SameSite=Lax`;
  } catch (err) {
    console.warn("[guest-session] Failed to save guest order to session:", err);
  }
}

/**
 * Clears guest orders from browser session
 */
export function clearGuestOrdersFromSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  } catch (err) {
    console.warn("[guest-session] Failed to clear guest orders:", err);
  }
}
