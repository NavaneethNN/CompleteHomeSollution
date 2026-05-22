import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  ShoppingCart,
  Package,
  Users,
  Crown,
  TrendingUp,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

export const metadata: Metadata = { title: "Dashboard — Admin" };

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  PENDING:    { label: "Pending",    icon: Clock,          className: "text-amber-600 bg-amber-50 border-amber-200" },
  PAID:       { label: "Paid",       icon: CheckCircle2,   className: "text-blue-600 bg-blue-50 border-blue-200" },
  PROCESSING: { label: "Processing", icon: TrendingUp,     className: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  SHIPPED:    { label: "Shipped",    icon: Package,        className: "text-violet-600 bg-violet-50 border-violet-200" },
  DELIVERED:  { label: "Delivered",  icon: CheckCircle2,   className: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  CANCELLED:  { label: "Cancelled",  icon: XCircle,        className: "text-red-600 bg-red-50 border-red-200" },
  REFUNDED:   { label: "Refunded",   icon: AlertCircle,    className: "text-orange-600 bg-orange-50 border-orange-200" },
};

async function getStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOrders,
    ordersThisMonth,
    totalRevenue,
    revenueThisMonth,
    totalProducts,
    totalCustomers,
    totalMembers,
    recentOrders,
    pendingOrders,
  ] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.order.aggregate({ where: { status: { not: "CANCELLED" } }, _sum: { total: true } }),
    db.order.aggregate({ where: { status: { not: "CANCELLED" }, createdAt: { gte: startOfMonth } }, _sum: { total: true } }),
    db.product.count({ where: { isActive: true } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { isMember: true } }),
    db.order.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        address: { select: { name: true } },
      },
    }),
    db.order.count({ where: { status: "PENDING" } }),
  ]);

  return {
    totalOrders,
    ordersThisMonth,
    totalRevenue: totalRevenue._sum.total ?? 0,
    revenueThisMonth: revenueThisMonth._sum.total ?? 0,
    totalProducts,
    totalCustomers,
    totalMembers,
    recentOrders,
    pendingOrders,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  const statCards = [
    {
      label: "Total Revenue",
      value: currencyFormatter.format(stats.totalRevenue),
      sub: `${currencyFormatter.format(stats.revenueThisMonth)} this month`,
      icon: TrendingUp,
      accent: "bg-emerald-500",
      href: "/admin/orders",
    },
    {
      label: "Orders",
      value: stats.totalOrders.toLocaleString(),
      sub: `${stats.ordersThisMonth} this month · ${stats.pendingOrders} pending`,
      icon: ShoppingCart,
      accent: "bg-blue-500",
      href: "/admin/orders",
    },
    {
      label: "Products",
      value: stats.totalProducts.toLocaleString(),
      sub: "Active listings",
      icon: Package,
      accent: "bg-violet-500",
      href: "/admin/products",
    },
    {
      label: "Customers",
      value: stats.totalCustomers.toLocaleString(),
      sub: `${stats.totalMembers} premium members`,
      icon: Users,
      accent: "bg-amber-500",
      href: "/admin/customers",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-black text-foreground">{card.value}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </Link>
          );
        })}
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Recent Orders</h2>
          <Link
            href="/admin/orders"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.recentOrders.map((order) => {
                const cfg = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG["PENDING"];
                const StatusIcon = cfg.icon;
                const customerName = order.user?.name ?? order.address?.name ?? "Guest";
                return (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        #{order.id.slice(-8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground font-medium">
                      {customerName}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {new Date(order.createdAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-bold text-foreground">
                      {currencyFormatter.format(order.total)}
                    </td>
                  </tr>
                );
              })}
              {stats.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { href: "/admin/products/new", label: "Add New Product", icon: Package, desc: "Create a new product listing" },
          { href: "/admin/membership", label: "Manage Membership", icon: Crown, desc: "View & manage premium members" },
          { href: "/admin/customers", label: "View Customers", icon: Users, desc: "Browse customer accounts" },
        ].map(({ href, label, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
