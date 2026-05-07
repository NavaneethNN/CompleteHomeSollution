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
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: Date;
  updatedAt: Date;
  address: {
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
    product: {
      id: string;
      name: string;
      slug: string;
      images: string[];
    };
  }[];
}

export async function getOrders(): Promise<{ orders: OrderWithItems[]; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { orders: [], error: "Unauthorized" };
  }

  try {
    const orders = await db.order.findMany({
      where: { userId: session.user.id },
      include: {
        address: {
          select: {
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
              select: {
                id: true,
                name: true,
                slug: true,
                images: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { orders };
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return { orders: [], error: "Failed to fetch orders" };
  }
}

export async function getOrderById(orderId: string): Promise<{ order: OrderWithItems | null; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { order: null, error: "Unauthorized" };
  }

  try {
    const order = await db.order.findFirst({
      where: { 
        id: orderId,
        userId: session.user.id,
      },
      include: {
        address: {
          select: {
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
              select: {
                id: true,
                name: true,
                slug: true,
                images: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { order: null, error: "Order not found" };
    }

    return { order };
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
    const [totalOrders, pendingOrders, recentOrders] = await Promise.all([
      db.order.count({ where: { userId: session.user.id } }),
      db.order.count({ 
        where: { 
          userId: session.user.id,
          status: { in: ["PENDING", "PAID", "PROCESSING", "SHIPPED"] }
        } 
      }),
      db.order.findMany({
        where: { userId: session.user.id },
        include: {
          address: {
            select: {
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
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  images: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return { totalOrders, pendingOrders, recentOrders };
  } catch (error) {
    console.error("Failed to fetch order stats:", error);
    return { totalOrders: 0, pendingOrders: 0, recentOrders: [], error: "Failed to fetch order stats" };
  }
}
