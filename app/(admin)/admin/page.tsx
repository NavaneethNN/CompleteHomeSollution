import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";
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
  Truck,
  Store,
  CreditCard,
  RotateCcw,
  BarChart3,
  AlertTriangle,
  Eye,
  ShieldCheck,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";

export const metadata: Metadata = { title: "Executive Dashboard — Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyDetailFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Settled statuses representing actual paid customer orders
const SETTLED_STATUSES: OrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  PENDING:          { label: "Pending",          icon: Clock,        className: "text-amber-700 bg-amber-50 border-amber-200" },
  PAID:             { label: "Paid",             icon: CreditCard,   className: "text-violet-700 bg-violet-50 border-violet-200" },
  CONFIRMED:        { label: "Confirmed",        icon: CheckCircle2, className: "text-teal-700 bg-teal-50 border-teal-200" },
  PROCESSING:       { label: "Processing",       icon: Package,      className: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  SHIPPED:          { label: "Shipped",          icon: Truck,        className: "text-blue-700 bg-blue-50 border-blue-200" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", icon: Truck,        className: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  DELIVERED:        { label: "Delivered",        icon: CheckCircle2, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  CANCELLED:        { label: "Cancelled",        icon: XCircle,      className: "text-rose-700 bg-rose-50 border-rose-200" },
  REFUNDED:         { label: "Refunded",         icon: RotateCcw,    className: "text-orange-700 bg-orange-50 border-orange-200" },
};

async function getStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalSettledRevenueAgg,
    revenueThisMonthAgg,
    totalSettledOrders,
    ordersThisMonth,
    activeFulfillments,
    pendingOrders,
    cancelledOrders,
    totalProducts,
    lowStockCount,
    totalCustomers,
    totalMembers,
    recentOrders,
  ] = await Promise.all([
    // Settled revenue strictly excludes CANCELLED and PENDING
    db.order.aggregate({
      where: { status: { in: SETTLED_STATUSES } },
      _sum: { total: true },
    }),
    db.order.aggregate({
      where: { status: { in: SETTLED_STATUSES }, createdAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    db.order.count({ where: { status: { in: SETTLED_STATUSES } } }),
    db.order.count({ where: { status: { in: SETTLED_STATUSES }, createdAt: { gte: startOfMonth } } }),
    db.order.count({ where: { status: { in: ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"] } } }),
    db.order.count({ where: { status: "PENDING" } }),
    db.order.count({ where: { status: "CANCELLED" } }),
    db.product.count({ where: { isActive: true } }),
    db.product.count({ where: { isActive: true, stock: { gt: 0, lte: 5 } } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { isMember: true } }),
    db.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        total: true,
        fulfillmentType: true,
        paywayTransactionId: true,
        stripePaymentId: true,
        createdAt: true,
        guestEmail: true,
        user: { select: { name: true, email: true } },
        address: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const settledRevenue = totalSettledRevenueAgg._sum.total ?? 0;
  const monthRevenue = revenueThisMonthAgg._sum.total ?? 0;
  const aov = totalSettledOrders > 0 ? settledRevenue / totalSettledOrders : 0;

  return {
    settledRevenue,
    monthRevenue,
    totalSettledOrders,
    ordersThisMonth,
    activeFulfillments,
    pendingOrders,
    cancelledOrders,
    aov,
    totalProducts,
    lowStockCount,
    totalCustomers,
    totalMembers,
    recentOrders,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  const statCards = [
    {
      label: "Net Settled Revenue",
      value: currencyFormatter.format(stats.settledRevenue),
      sub: `${currencyFormatter.format(stats.monthRevenue)} this month`,
      extra: "Excludes cancelled & unpaid",
      icon: DollarSign,
      accent: "bg-emerald-600 text-white",
      href: "/admin/analytics",
    },
    {
      label: "Settled Orders",
      value: stats.totalSettledOrders.toLocaleString(),
      sub: `${stats.ordersThisMonth} placed this month`,
      extra: `${stats.activeFulfillments} in fulfillment queue`,
      icon: ShoppingCart,
      accent: "bg-blue-600 text-white",
      href: "/admin/orders",
    },
    {
      label: "Catalog & Inventory",
      value: stats.totalProducts.toLocaleString(),
      sub: stats.lowStockCount > 0 ? `${stats.lowStockCount} products low stock` : "All products in stock",
      extra: "Active listings",
      icon: Package,
      accent: stats.lowStockCount > 0 ? "bg-amber-500 text-white" : "bg-violet-600 text-white",
      href: "/admin/products",
    },
    {
      label: "Customer & Members",
      value: stats.totalCustomers.toLocaleString(),
      sub: `${stats.totalMembers} premium members`,
      extra: stats.totalCustomers > 0 ? `${Math.round((stats.totalMembers / stats.totalCustomers) * 100)}% VIP penetration` : "—",
      icon: Users,
      accent: "bg-indigo-600 text-white",
      href: "/admin/customers",
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header & Quick Action Hub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Operations Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Complete Home Sollution · Real-time operational overview and order fulfillment pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/analytics"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>Financial Analytics</span>
          </Link>
          <Link
            href="/admin/products/new"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 transition-opacity"
          >
            <Package className="h-4 w-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Operational Pulse Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fulfillment Active</p>
            <p className="text-lg font-black text-blue-600">{stats.activeFulfillments} orders</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Truck className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Average Order Value</p>
            <p className="text-lg font-black text-foreground">{currencyFormatter.format(stats.aov)}</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Low Stock Warnings</p>
            <p className={`text-lg font-black ${stats.lowStockCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {stats.lowStockCount} items
            </p>
          </div>
          <div className={`h-8 w-8 rounded-lg ${stats.lowStockCount > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"} flex items-center justify-center`}>
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Checkouts</p>
            <p className="text-lg font-black text-muted-foreground">{stats.pendingOrders}</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <Clock className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Primary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-black text-foreground tracking-tight">{card.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{card.extra}</p>
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.accent} shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                <span className="font-semibold text-foreground">{card.sub}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Orders Section */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div>
            <h2 className="text-sm font-bold text-foreground">Recent Orders</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Real-time customer transactions & fulfillment status</p>
          </div>
          <Link
            href="/admin/orders"
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            View all orders <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Order</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Fulfillment</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Items</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.recentOrders.map((order) => {
                const cfg = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG["PENDING"];
                const StatusIcon = cfg.icon;
                const customerName = order.user?.name ?? order.address?.name ?? "Guest Customer";
                const customerEmail = order.user?.email ?? order.guestEmail ?? "";
                const isPickup = order.fulfillmentType === "STORE_PICKUP";
                const isManual = order.fulfillmentType === "MANUAL_DELIVERY";

                return (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    {/* Order ID */}
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-xs font-bold text-primary hover:underline"
                      >
                        #{order.id.slice(-8).toUpperCase()}
                      </Link>
                    </td>

                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{customerName}</p>
                        {customerEmail && (
                          <p className="text-[10px] text-muted-foreground truncate">{customerEmail}</p>
                        )}
                      </div>
                    </td>

                    {/* Fulfillment */}
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
                        {isPickup ? (
                          <>
                            <Store className="h-3.5 w-3.5 text-emerald-600" />
                            Store Pickup
                          </>
                        ) : isManual ? (
                          <>
                            <Truck className="h-3.5 w-3.5 text-indigo-600" />
                            Local Delivery
                          </>
                        ) : (
                          <>
                            <Truck className="h-3.5 w-3.5 text-blue-600" />
                            Courier Delivery
                          </>
                        )}
                      </span>
                    </td>

                    {/* Items */}
                    <td className="px-5 py-3.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {order._count.items} item{order._count.items !== 1 ? "s" : ""}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(order.createdAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="px-5 py-3.5 text-right text-xs font-black text-foreground">
                      {currencyDetailFormatter.format(order.total)}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {stats.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No orders recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { href: "/admin/products/new", label: "Add New Product", icon: Package, desc: "Create a new catalog item & manage variants" },
          { href: "/admin/membership", label: "VIP Memberships", icon: Crown, desc: "Manage member subscriptions & tiers" },
          { href: "/admin/analytics", label: "Financial Deep Dive", icon: BarChart3, desc: "Inspect 12-month trends & category revenue" },
        ].map(({ href, label, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground text-primary transition-all">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{desc}</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>

    </div>
  );
}
