import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  Crown,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Star,
  BarChart3,
  Activity,
} from "lucide-react";
import {
  RevenueBarChart,
  DonutChart,
  HorizontalBarChart,
  Sparkline,
  type MonthlyDataPoint,
  type DonutSegment,
  type HorizontalBarItem,
} from "@/components/admin/analytics-charts";

export const metadata: Metadata = { title: "Analytics — Admin" };

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_COLORS: Record<string, string> = {
  PENDING:          "#f59e0b",
  PAID:             "#3b82f6",
  CONFIRMED:        "#8b5cf6",
  PROCESSING:       "#6366f1",
  SHIPPED:          "#0ea5e9",
  OUT_FOR_DELIVERY: "#10b981",
  DELIVERED:        "#22c55e",
  CANCELLED:        "#ef4444",
  REFUNDED:         "#f97316",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:          "Pending",
  PAID:             "Paid",
  CONFIRMED:        "Confirmed",
  PROCESSING:       "Processing",
  SHIPPED:          "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED:        "Delivered",
  CANCELLED:        "Cancelled",
  REFUNDED:         "Refunded",
};

async function getAnalyticsData() {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [
    // KPI totals
    totalRevenue,
    revenueThisMonth,
    revenueLastMonth,
    totalOrders,
    ordersThisMonth,
    ordersLastMonth,
    totalCustomers,
    customersThisMonth,
    customersLastMonth,
    totalMembers,
    membersThisMonth,
    membersLastMonth,

    // Monthly breakdown (last 12 months)
    monthlyOrders,

    // Order status distribution
    ordersByStatus,

    // Top products by revenue
    topProducts,

    // Top categories by revenue
    topCategories,

    // Customer growth (last 12 months)
    customerGrowth,

    // Average order value this month vs last
    avgOrderThisMonth,
    avgOrderLastMonth,

    // Top reviewed products
    topReviewed,

    // Low stock alert count
    lowStockCount,
  ] = await Promise.all([
    // Revenue
    db.order.aggregate({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] } }, _sum: { total: true } }),
    db.order.aggregate({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: thisMonthStart } }, _sum: { total: true } }),
    db.order.aggregate({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { total: true } }),

    // Orders
    db.order.count(),
    db.order.count({ where: { createdAt: { gte: thisMonthStart } } }),
    db.order.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),

    // Customers
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: thisMonthStart } } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),

    // Members
    db.user.count({ where: { isMember: true } }),
    db.user.count({ where: { isMember: true, memberSince: { gte: thisMonthStart } } }),
    db.user.count({ where: { isMember: true, memberSince: { gte: lastMonthStart, lte: lastMonthEnd } } }),

    // Monthly orders (raw, for revenue we aggregate per month below)
    db.order.findMany({
      where: { createdAt: { gte: twelveMonthsAgo }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    }),

    // Orders by status
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),

    // Top products by revenue from order items
    db.orderItem.groupBy({
      by: ["productId"],
      _sum: { unitPrice: true },
      _count: { _all: true },
      orderBy: { _sum: { unitPrice: "desc" } },
      take: 8,
    }),

    // Top categories by revenue
    db.orderItem.findMany({
      where: { order: { status: { notIn: ["CANCELLED", "REFUNDED"] } } },
      select: {
        unitPrice: true,
        quantity: true,
        product: { select: { category: { select: { name: true } } } },
      },
    }),

    // Customer signups per month
    db.user.findMany({
      where: { role: "CUSTOMER", createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    }),

    // Avg order value
    db.order.aggregate({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: thisMonthStart } }, _avg: { total: true } }),
    db.order.aggregate({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } }, _avg: { total: true } }),

    // Top reviewed products
    db.product.findMany({
      where: { isActive: true },
      select: { name: true, reviews: { select: { rating: true } }, _count: { select: { reviews: true } } },
      orderBy: { reviews: { _count: "desc" } },
      take: 5,
    }),

    // Low stock
    db.product.count({ where: { isActive: true, stock: { gt: 0, lte: 5 } } }),
  ]);

  // ── Build monthly data (last 12 months) ──────────────────────────────────
  const monthlyMap: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthlyMap[key] = { revenue: 0, orders: 0 };
  }
  for (const o of monthlyOrders) {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthlyMap[key]) {
      monthlyMap[key].revenue += o.total;
      monthlyMap[key].orders += 1;
    }
  }
  const monthlyData: MonthlyDataPoint[] = Object.entries(monthlyMap).map(([key, val]) => {
    const [year, month] = key.split("-").map(Number);
    return { month: MONTH_NAMES[month], revenue: Math.round(val.revenue), orders: val.orders };
  });

  // ── Revenue sparkline (last 6 months) ────────────────────────────────────
  const sparklineRevenue = monthlyData.slice(-6).map((d) => d.revenue);

  // ── Order status donut ────────────────────────────────────────────────────
  const statusSegments: DonutSegment[] = ordersByStatus
    .filter((s) => s._count._all > 0)
    .map((s) => ({
      label: STATUS_LABELS[s.status] ?? s.status,
      value: s._count._all,
      color: STATUS_COLORS[s.status] ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);

  // ── Top products (resolve names) ─────────────────────────────────────────
  const productIds = topProducts.map((p) => p.productId);
  const productNames = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(productNames.map((p) => [p.id, p.name]));

  const topProductItems: HorizontalBarItem[] = topProducts.map((p) => ({
    label: nameMap[p.productId] ?? "Unknown",
    value: Math.round(p._sum.unitPrice ?? 0),
    sub: `×${p._count._all}`,
  }));

  // ── Category revenue ─────────────────────────────────────────────────────
  const catMap: Record<string, number> = {};
  for (const item of topCategories) {
    const cat = item.product.category.name;
    catMap[cat] = (catMap[cat] ?? 0) + item.unitPrice * item.quantity;
  }
  const categoryItems: HorizontalBarItem[] = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, value]) => ({ label, value: Math.round(value) }));

  // ── Customer growth per month ─────────────────────────────────────────────
  const custMonthMap: Record<string, number> = {};
  for (const key of Object.keys(monthlyMap)) custMonthMap[key] = 0;
  for (const u of customerGrowth) {
    const d = new Date(u.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (custMonthMap[key] !== undefined) custMonthMap[key] += 1;
  }
  const customerSparkline = Object.values(custMonthMap).slice(-6);

  // ── Top reviewed products ─────────────────────────────────────────────────
  const topReviewedItems = topReviewed
    .filter((p) => p._count.reviews > 0)
    .map((p) => {
      const avg = p.reviews.reduce((s, r) => s + r.rating, 0) / (p.reviews.length || 1);
      return { name: p.name, count: p._count.reviews, avg: Math.round(avg * 10) / 10 };
    });

  // ── MoM delta helpers ─────────────────────────────────────────────────────
  const revThis = revenueThisMonth._sum.total ?? 0;
  const avgThis = avgOrderThisMonth._avg.total ?? 0;
  const avgLast = avgOrderLastMonth._avg.total ?? 0;

  return {
    kpis: {
      revenue:     { value: totalRevenue._sum.total ?? 0, thisMonth: revThis, lastMonth: revenueLastMonth._sum.total ?? 0 },
      orders:      { value: totalOrders, thisMonth: ordersThisMonth, lastMonth: ordersLastMonth },
      customers:   { value: totalCustomers, thisMonth: customersThisMonth, lastMonth: customersLastMonth },
      members:     { value: totalMembers, thisMonth: membersThisMonth, lastMonth: membersLastMonth },
      avgOrder:    { value: avgThis, lastMonth: avgLast },
    },
    monthlyData,
    sparklineRevenue,
    customerSparkline,
    statusSegments,
    topProductItems,
    categoryItems,
    topReviewedItems,
    lowStockCount,
    totalOrderCount: totalOrders,
  };
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
        <Minus className="h-2.5 w-2.5" /> —
      </span>
    );
  }
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
        up ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct)}% vs last month
    </span>
  );
}

export default async function AdminAnalyticsPage() {
  const data = await getAnalyticsData();
  const { kpis, monthlyData, sparklineRevenue, customerSparkline, statusSegments, topProductItems, categoryItems, topReviewedItems, lowStockCount, totalOrderCount } = data;

  const kpiCards = [
    {
      label: "Total Revenue",
      value: currencyFormatter.format(kpis.revenue.value),
      sub: `${currencyFormatter.format(kpis.revenue.thisMonth)} this month`,
      icon: TrendingUp,
      accent: "bg-emerald-500",
      delta: { current: kpis.revenue.thisMonth, previous: kpis.revenue.lastMonth },
      sparkline: sparklineRevenue,
      sparkColor: "#10b981",
    },
    {
      label: "Total Orders",
      value: kpis.orders.value.toLocaleString(),
      sub: `${kpis.orders.thisMonth} orders this month`,
      icon: ShoppingCart,
      accent: "bg-blue-500",
      delta: { current: kpis.orders.thisMonth, previous: kpis.orders.lastMonth },
      sparkline: monthlyData.slice(-6).map((d) => d.orders),
      sparkColor: "#3b82f6",
    },
    {
      label: "Customers",
      value: kpis.customers.value.toLocaleString(),
      sub: `+${kpis.customers.thisMonth} new this month`,
      icon: Users,
      accent: "bg-violet-500",
      delta: { current: kpis.customers.thisMonth, previous: kpis.customers.lastMonth },
      sparkline: customerSparkline,
      sparkColor: "#8b5cf6",
    },
    {
      label: "Members",
      value: kpis.members.value.toLocaleString(),
      sub: `+${kpis.members.thisMonth} new this month`,
      icon: Crown,
      accent: "bg-amber-500",
      delta: { current: kpis.members.thisMonth, previous: kpis.members.lastMonth },
      sparkline: null,
      sparkColor: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Business performance overview</p>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <Package className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-amber-700">
              {lowStockCount} product{lowStockCount !== 1 ? "s" : ""} low on stock
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    {card.label}
                  </p>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-foreground leading-none">
                    {card.value}
                  </p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                  <DeltaBadge current={card.delta.current} previous={card.delta.previous} />
                </div>
                {card.sparkline && card.sparkline.length >= 2 && (
                  <Sparkline data={card.sparkline} color={card.sparkColor} height={32} width={64} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Avg order value */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Order Value</p>
          <p className="mt-1 text-2xl font-black text-foreground">{currencyFormatter.format(kpis.avgOrder.value)}</p>
          <DeltaBadge current={kpis.avgOrder.value} previous={kpis.avgOrder.lastMonth} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conversion Rate</p>
          <p className="mt-1 text-2xl font-black text-foreground">
            {kpis.customers.value > 0
              ? `${Math.round((kpis.orders.value / kpis.customers.value) * 100)}%`
              : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Orders per customer (all-time)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Member Penetration</p>
          <p className="mt-1 text-2xl font-black text-foreground">
            {kpis.customers.value > 0
              ? `${Math.round((kpis.members.value / kpis.customers.value) * 100)}%`
              : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Customers with premium membership</p>
        </div>
      </div>

      {/* Revenue & Orders chart */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Revenue & Orders — Last 12 Months</h2>
        </div>
        <div className="p-5">
          <RevenueBarChart data={monthlyData} />
        </div>
      </div>

      {/* Two-column: Order Status + Top Products */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Order Status Distribution */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Order Status Distribution</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">All {totalOrderCount} orders</p>
          </div>
          <div className="p-5">
            {statusSegments.length > 0 ? (
              <DonutChart
                segments={statusSegments}
                total={totalOrderCount}
                centerLabel="Total"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No orders yet.</p>
            )}
          </div>
        </div>

        {/* Top Products by Revenue */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Top Products by Revenue</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Based on completed order items</p>
          </div>
          <div className="p-5">
            {topProductItems.length > 0 ? (
              <HorizontalBarChart
                items={topProductItems}
                formatter={(v) => currencyFormatter.format(v)}
                colorClass="bg-primary"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No order data yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Two-column: Categories + Reviews */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Revenue by Category */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Revenue by Category</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Top 6 categories by sales</p>
          </div>
          <div className="p-5">
            {categoryItems.length > 0 ? (
              <HorizontalBarChart
                items={categoryItems}
                formatter={(v) => currencyFormatter.format(v)}
                colorClass="bg-violet-500"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet.</p>
            )}
          </div>
        </div>

        {/* Top Reviewed Products */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Most Reviewed Products</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">By review count</p>
          </div>
          <div className="p-5">
            {topReviewedItems.length > 0 ? (
              <div className="space-y-3">
                {topReviewedItems.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-2.5 w-2.5 ${s <= Math.round(p.avg) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
                          />
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-0.5">{p.avg}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-foreground shrink-0">{p.count} reviews</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No reviews yet.</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

