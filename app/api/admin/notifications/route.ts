import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [
    pendingOrders,
    refundRequests,
    lowStockProducts,
    newCustomers,
    newOrders,
  ] = await Promise.all([
    // Pending orders (awaiting payment / action)
    db.order.findMany({
      where: { status: "PENDING" },
      select: { id: true, total: true, createdAt: true, user: { select: { name: true } }, address: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),

    // Refund requests not yet processed
    db.order.findMany({
      where: { refundRequested: true, status: { not: "REFUNDED" } },
      select: { id: true, total: true, createdAt: true, refundReason: true, user: { select: { name: true } }, address: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),

    // Products with stock <= 5 (low stock)
    db.product.findMany({
      where: { isActive: true, stock: { gt: 0, lte: 5 } },
      select: { id: true, name: true, stock: true, updatedAt: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),

    // New customers in the last 24 hours
    db.user.findMany({
      where: { role: "CUSTOMER", createdAt: { gte: oneDayAgo } },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // New orders in the last hour
    db.order.findMany({
      where: { createdAt: { gte: oneHourAgo } },
      select: { id: true, total: true, createdAt: true, user: { select: { name: true } }, address: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const notifications: {
    id: string;
    type: "pending_order" | "refund_request" | "low_stock" | "new_customer" | "new_order";
    title: string;
    description: string;
    href: string;
    createdAt: string;
    priority: "high" | "medium" | "low";
  }[] = [];

  // Refund requests — highest priority
  for (const o of refundRequests) {
    const customer = o.user?.name ?? o.address?.name ?? "Guest";
    notifications.push({
      id: `refund-${o.id}`,
      type: "refund_request",
      title: "Refund Requested",
      description: `${customer} — A$${o.total.toFixed(2)}${o.refundReason ? ` · "${o.refundReason.slice(0, 40)}"` : ""}`,
      href: `/admin/orders/${o.id}`,
      createdAt: o.createdAt.toISOString(),
      priority: "high",
    });
  }

  // New orders (last hour)
  for (const o of newOrders) {
    const customer = o.user?.name ?? o.address?.name ?? "Guest";
    notifications.push({
      id: `new-order-${o.id}`,
      type: "new_order",
      title: "New Order",
      description: `${customer} placed an order for A$${o.total.toFixed(2)}`,
      href: `/admin/orders/${o.id}`,
      createdAt: o.createdAt.toISOString(),
      priority: "medium",
    });
  }

  // Pending orders
  for (const o of pendingOrders) {
    const customer = o.user?.name ?? o.address?.name ?? "Guest";
    notifications.push({
      id: `pending-${o.id}`,
      type: "pending_order",
      title: "Pending Order",
      description: `${customer} — A$${o.total.toFixed(2)} awaiting payment`,
      href: `/admin/orders/${o.id}`,
      createdAt: o.createdAt.toISOString(),
      priority: "medium",
    });
  }

  // Low stock
  for (const p of lowStockProducts) {
    notifications.push({
      id: `stock-${p.id}`,
      type: "low_stock",
      title: "Low Stock Alert",
      description: `"${p.name}" has only ${p.stock} unit${p.stock === 1 ? "" : "s"} left`,
      href: `/admin/products/${p.id}`,
      createdAt: p.updatedAt.toISOString(),
      priority: p.stock <= 2 ? "high" : "medium",
    });
  }

  // New customers
  for (const u of newCustomers) {
    notifications.push({
      id: `customer-${u.id}`,
      type: "new_customer",
      title: "New Customer",
      description: `${u.name ?? u.email ?? "Someone"} just signed up`,
      href: `/admin/customers`,
      createdAt: u.createdAt.toISOString(),
      priority: "low",
    });
  }

  // Sort: high → medium → low, then by recency
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  notifications.sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return NextResponse.json({
    notifications: notifications.slice(0, 20),
    counts: {
      total: notifications.length,
      high: notifications.filter((n) => n.priority === "high").length,
      refundRequests: refundRequests.length,
      pendingOrders: pendingOrders.length,
      lowStock: lowStockProducts.length,
    },
  });
}
