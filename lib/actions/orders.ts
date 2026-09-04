"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

export interface OrderWithItems {
  id: string;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  paywayTransactionId: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  guestEmail: string | null;
  refundRequested: boolean;
  refundReason: string | null;
  refundAmount: number | null;
  refundedAt: Date | null;
  refundStripeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  address: {
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    suburb: string;
    state: string;
    postcode: string;
    country: string;
  };
  items: {
    id: string;
    quantity: number;
    unitPrice: number;
    variantSummary: string | null;
    productVariantId: string | null;
    productVariant: {
      id: string;
      sku: string;
      images: { url: string; displayOrder: number }[];
      values: {
        variantValue: {
          value: string;
          variantAttribute: { name: string };
        };
      }[];
    } | null;
    product: {
      id: string;
      name: string;
      slug: string;
      images: string[];
      // P-7: categoryId included here to avoid a separate category lookup
      categoryId: string;
    };
  }[];
}

// P-2: Single shared include object — eliminates duplicated query definitions
// across getOrders, getOrderById, and getOrderStats.
const orderInclude = {
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
      // P-7: Select categoryId in the same query to avoid a redundant lookup
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

// B-4: Pagination support — page is 1-indexed, pageSize defaults to 10
export async function getOrders(
  page = 1,
  pageSize = 10
): Promise<{ orders: OrderWithItems[]; total: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { orders: [], total: 0, error: "Unauthorized" };
  }

  try {
    const where = { userId: session.user.id };
    const skip = (Math.max(1, page) - 1) * pageSize;

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip,
      }),
      db.order.count({ where }),
    ]);

    return { orders: orders as unknown as OrderWithItems[], total };
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return { orders: [], total: 0, error: "Failed to fetch orders" };
  }
}

export async function getOrderById(
  orderId: string
): Promise<{ order: OrderWithItems | null; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { order: null, error: "Unauthorized" };
  }

  try {
    const order = await db.order.findFirst({
      where: { id: orderId, userId: session.user.id },
      include: orderInclude,
    });

    if (!order) return { order: null, error: "Order not found" };
    return { order: order as unknown as OrderWithItems };
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return { order: null, error: "Failed to fetch order" };
  }
}

export async function getOrderStats(): Promise<{
  totalOrders: number;
  pendingOrders: number;
  recentOrders: OrderWithItems[];
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { totalOrders: 0, pendingOrders: 0, recentOrders: [], error: "Unauthorized" };
  }

  try {
    // P-2: Reuse shared orderInclude — no inline duplication
    const [totalOrders, pendingOrders, recentOrders] = await Promise.all([
      db.order.count({ where: { userId: session.user.id } }),
      db.order.count({
        where: {
          userId: session.user.id,
          status: { in: ["PENDING", "PAID", "PROCESSING", "SHIPPED"] as OrderStatus[] },
        },
      }),
      db.order.findMany({
        where: { userId: session.user.id },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      recentOrders: recentOrders as unknown as OrderWithItems[],
    };
  } catch (error) {
    console.error("Failed to fetch order stats:", error);
    return { totalOrders: 0, pendingOrders: 0, recentOrders: [], error: "Failed to fetch order stats" };
  }
}
