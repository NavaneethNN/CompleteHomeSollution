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
  stripePaymentId: string | null;
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
    };
  }[];
}

// Shared include for all order queries
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
      product: {
        select: { id: true, name: true, slug: true, images: true },
      },
      productVariant: {
        include: {
          values: {
            include: {
              variantValue: {
                include: { variantAttribute: { select: { name: true } } },
              },
            },
          },
        },
        select: undefined,
      },
    },
  },
} as const;

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
            name: true, phone: true,
            line1: true, line2: true,
            suburb: true, state: true, postcode: true, country: true,
          },
        },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, images: true } },
            productVariant: {
              include: {
                images: { orderBy: { displayOrder: "asc" } },
                values: {
                  include: {
                    variantValue: { include: { variantAttribute: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { orders: orders as unknown as OrderWithItems[] };
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
      where: { id: orderId, userId: session.user.id },
      include: {
        address: {
          select: {
            name: true, phone: true,
            line1: true, line2: true,
            suburb: true, state: true, postcode: true, country: true,
          },
        },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, images: true } },
            productVariant: {
              include: {
                images: { orderBy: { displayOrder: "asc" } },
                values: {
                  include: {
                    variantValue: { include: { variantAttribute: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        },
      },
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
              name: true, phone: true,
              line1: true, line2: true,
              suburb: true, state: true, postcode: true, country: true,
            },
          },
          items: {
            include: {
              product: { select: { id: true, name: true, slug: true, images: true } },
              productVariant: {
                include: {
                  images: { orderBy: { displayOrder: "asc" } },
                  values: {
                    include: {
                      variantValue: { include: { variantAttribute: { select: { name: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return { totalOrders, pendingOrders, recentOrders: recentOrders as unknown as OrderWithItems[] };
  } catch (error) {
    console.error("Failed to fetch order stats:", error);
    return { totalOrders: 0, pendingOrders: 0, recentOrders: [], error: "Failed to fetch order stats" };
  }
}
