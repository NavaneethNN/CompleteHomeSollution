import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { cacheFetch } from "@/lib/redis";
import type { OrderStatus } from "@prisma/client";
import {
  TrendingUp,
  ShoppingCart,
  Crown,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Star,
  BarChart3,
  Activity,
  Truck,
  Store,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DollarSign,
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

export const metadata: Metadata = { title: "Analytics & Financials — Admin" };
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Settled statuses that represent legitimate, paid customer orders.
// CANCELLED and PENDING (unpaid/abandoned) are NEVER included in settled revenue.
const SETTLED_STATUSES: OrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const STATUS_COLORS: Record<string, string> = {
  DELIVERED:        "#10b981", // emerald
  OUT_FOR_DELIVERY: "#06b6d4", // cyan
  SHIPPED:          "#3b82f6", // blue
  PROCESSING:       "#6366f1", // indigo
  CONFIRMED:        "#14b8a6", // teal
  PAID:             "#8b5cf6", // violet
  REFUNDED:         "#f59e0b", // amber
  CANCELLED:        "#ef4444", // red
  PENDING:          "#94a3b8", // slate
};

const STATUS_LABELS: Record<string, string> = {
  DELIVERED:        "Delivered",
  OUT_FOR_DELIVERY: "Out for Delivery",
  SHIPPED:          "Shipped",
  PROCESSING:       "Processing",
  CONFIRMED:        "Confirmed",
  PAID:             "Paid",
  REFUNDED:         "Refunded",
  CANCELLED:        "Cancelled",
  PENDING:          "Pending Checkout",
};

async function getAnalyticsData() {
  return cacheFetch("admin:analytics:summary:v3", 15, async () => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      // Gross settled revenue
      totalSettledRevenueAgg,
      revenueThisMonthAgg,
      revenueLastMonthAgg,

      // Settled order counts
      totalSettledOrders,
      ordersThisMonth,
      ordersLastMonth,

      // Total orders created (for cancellation/drop-off rate calculation)
      allOrdersCount,
      cancelledOrdersCount,
      refundedOrdersCount,
      pendingOrdersCount,

      // Customers
      totalCustomers,
      customersThisMonth,
      customersLastMonth,

      // Members
      totalMembers,
      membersThisMonth,
      membersLastMonth,

      // Monthly settled orders (for 12-month revenue trend)
      monthlySettledOrders,

      // Orders by status
      ordersByStatus,

      // Settled order items for accurate top products & category revenue
      settledOrderItems,

      // Customer signups per month
      customerGrowth,

      // Top reviewed products
      topReviewed,

      // Inventory health
      lowStockCount,
      outOfStockCount,
      activeProductCount,

      // Refund details on settled orders
      settledRefundsAgg,
      allRefundsAgg,

      // Fulfillment distribution
      fulfillmentBreakdown,

      // Payment gateway breakdown
      paywayOrderCount,
      stripeOrderCount,
    ] = await Promise.all([
      // Settled Revenue (Strictly excludes CANCELLED and PENDING)
      db.order.aggregate({
        where: { status: { in: SETTLED_STATUSES } },
        _sum: { total: true },
      }),
      db.order.aggregate({
        where: { status: { in: SETTLED_STATUSES }, createdAt: { gte: thisMonthStart } },
        _sum: { total: true },
      }),
      db.order.aggregate({
        where: { status: { in: SETTLED_STATUSES }, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { total: true },
      }),

      // Settled Orders count
      db.order.count({ where: { status: { in: SETTLED_STATUSES } } }),
      db.order.count({ where: { status: { in: SETTLED_STATUSES }, createdAt: { gte: thisMonthStart } } }),
      db.order.count({ where: { status: { in: SETTLED_STATUSES }, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),

      // All created orders breakdown (for full operational visibility)
      db.order.count(),
      db.order.count({ where: { status: "CANCELLED" } }),
      db.order.count({ where: { status: "REFUNDED" } }),
      db.order.count({ where: { status: "PENDING" } }),

      // Customers
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: thisMonthStart } } }),
      db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),

      // Members
      db.user.count({ where: { isMember: true } }),
      db.user.count({ where: { isMember: true, memberSince: { gte: thisMonthStart } } }),
      db.user.count({ where: { isMember: true, memberSince: { gte: lastMonthStart, lte: lastMonthEnd } } }),

      // Monthly settled orders (last 12 months)
      db.order.findMany({
        where: {
          createdAt: { gte: twelveMonthsAgo },
          status: { in: SETTLED_STATUSES },
        },
        select: { createdAt: true, total: true, refundAmount: true },
        orderBy: { createdAt: "asc" },
      }),

      // Orders by status
      db.order.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { total: true },
      }),

      // Settled order items (Strictly settled orders, calculating line revenue accurately: quantity * unitPrice)
      db.orderItem.findMany({
        where: {
          order: {
            status: { in: SETTLED_STATUSES },
          },
        },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          product: {
            select: {
              id: true,
              name: true,
              category: { select: { name: true } },
            },
          },
        },
      }),

      // Customer signups
      db.user.findMany({
        where: { role: "CUSTOMER", createdAt: { gte: twelveMonthsAgo } },
        take: 1000,
        select: { createdAt: true },
      }),

      // Top reviewed products
      db.product.findMany({
        where: { isActive: true },
        select: {
          name: true,
          reviews: { select: { rating: true } },
          _count: { select: { reviews: true } },
        },
        orderBy: { reviews: { _count: "desc" } },
        take: 5,
      }),

      // Inventory
      db.product.count({ where: { isActive: true, stock: { gt: 0, lte: 5 } } }),
      db.product.count({ where: { isActive: true, stock: 0 } }),
      db.product.count({ where: { isActive: true } }),

      // Partial refunds on settled orders
      db.order.aggregate({
        where: {
          status: { in: SETTLED_STATUSES },
          refundAmount: { gt: 0 },
        },
        _sum: { refundAmount: true },
      }),

      // All refunds (settled partial + fully refunded orders)
      db.order.aggregate({
        where: {
          OR: [
            { status: "REFUNDED" },
            { refundAmount: { gt: 0 } },
          ],
        },
        _sum: { refundAmount: true, total: true },
      }),

      // Fulfillment breakdown for settled orders
      db.order.groupBy({
        by: ["fulfillmentType"],
        where: { status: { in: SETTLED_STATUSES } },
        _count: { _all: true },
        _sum: { total: true },
      }),

      // Payment gateway counts on settled orders
      db.order.count({ where: { status: { in: SETTLED_STATUSES }, paywayTransactionId: { not: null } } }),
      db.order.count({ where: { status: { in: SETTLED_STATUSES }, stripePaymentId: { not: null } } }),
    ]);

    // ── Accurate Financial Math ───────────────────────────────────────────────
    const grossRevenue = totalSettledRevenueAgg._sum.total ?? 0;
    const partialRefunds = settledRefundsAgg._sum.refundAmount ?? 0;
    const netRevenue = Math.max(0, grossRevenue - partialRefunds);

    const grossThisMonth = revenueThisMonthAgg._sum.total ?? 0;
    const grossLastMonth = revenueLastMonthAgg._sum.total ?? 0;

    // Total refund volume (full refunds + partial)
    const totalRefundVolume = (allRefundsAgg._sum.refundAmount ?? 0) || (allRefundsAgg._sum.total ?? 0);

    // Settled AOV (Net Revenue / Settled Orders)
    const aovAllTime = totalSettledOrders > 0 ? netRevenue / totalSettledOrders : 0;
    const aovThisMonth = ordersThisMonth > 0 ? grossThisMonth / ordersThisMonth : 0;
    const aovLastMonth = ordersLastMonth > 0 ? grossLastMonth / ordersLastMonth : 0;

    // Cancellation & Abandonment rate
    const nonPendingTotal = allOrdersCount - pendingOrdersCount;
    const cancellationRate = nonPendingTotal > 0
      ? Math.round((cancelledOrdersCount / nonPendingTotal) * 100)
      : 0;

    // ── Build 12-Month Historical Data (Strictly Settled Orders) ───────────────
    const monthlyMap: Record<string, { revenue: number; orders: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyMap[key] = { revenue: 0, orders: 0 };
    }
    for (const o of monthlySettledOrders) {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthlyMap[key]) {
        const orderNet = Math.max(0, o.total - (o.refundAmount ?? 0));
        monthlyMap[key].revenue += orderNet;
        monthlyMap[key].orders += 1;
      }
    }
    const monthlyData: MonthlyDataPoint[] = Object.entries(monthlyMap).map(([key, val]) => {
      const [, month] = key.split("-").map(Number);
      return { month: MONTH_NAMES[month], revenue: Math.round(val.revenue), orders: val.orders };
    });

    const sparklineRevenue = monthlyData.slice(-6).map((d) => d.revenue);

    // ── Order Status Donut (All Orders) ───────────────────────────────────────
    const statusSegments: DonutSegment[] = ordersByStatus
      .filter((s) => s._count._all > 0)
      .map((s) => ({
        label: STATUS_LABELS[s.status] ?? s.status,
        value: s._count._all,
        color: STATUS_COLORS[s.status] ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);

    // ── Top Products by Settled Revenue (Strictly from Settled Items) ─────────
    const productAggMap: Record<string, { name: string; revenue: number; units: number; category: string }> = {};
    const categoryAggMap: Record<string, number> = {};

    for (const item of settledOrderItems) {
      const qty = item.quantity || 1;
      const lineRevenue = (item.unitPrice || 0) * qty;
      const pId = item.productId;
      const pName = item.product?.name ?? "Custom Order Item";
      const catName = item.product?.category?.name ?? "General";

      if (!productAggMap[pId]) {
        productAggMap[pId] = { name: pName, revenue: 0, units: 0, category: catName };
      }
      productAggMap[pId].revenue += lineRevenue;
      productAggMap[pId].units += qty;

      categoryAggMap[catName] = (categoryAggMap[catName] ?? 0) + lineRevenue;
    }

    const topProductItems: HorizontalBarItem[] = Object.values(productAggMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((p) => ({
        label: p.name,
        value: Math.round(p.revenue),
        sub: `${p.units} sold · ${p.category}`,
      }));

    const categoryItems: HorizontalBarItem[] = Object.entries(categoryAggMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([label, value]) => ({
        label,
        value: Math.round(value),
      }));

    // ── Fulfillment Distribution ──────────────────────────────────────────────
    const fulfillmentMap: Record<string, { count: number; revenue: number; label: string }> = {
      DELIVERY: { count: 0, revenue: 0, label: "Courier Delivery" },
      STORE_PICKUP: { count: 0, revenue: 0, label: "In-Store Pickup" },
      MANUAL_DELIVERY: { count: 0, revenue: 0, label: "Store Direct Delivery" },
    };

    for (const fb of fulfillmentBreakdown) {
      const key = fb.fulfillmentType || "DELIVERY";
      if (!fulfillmentMap[key]) {
        fulfillmentMap[key] = { count: 0, revenue: 0, label: key };
      }
      fulfillmentMap[key].count += fb._count._all;
      fulfillmentMap[key].revenue += fb._sum.total ?? 0;
    }

    // ── Customer Growth Sparkline ─────────────────────────────────────────────
    const custMonthMap: Record<string, number> = {};
    for (const key of Object.keys(monthlyMap)) custMonthMap[key] = 0;
    for (const u of customerGrowth) {
      const d = new Date(u.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (custMonthMap[key] !== undefined) custMonthMap[key] += 1;
    }
    const customerSparkline = Object.values(custMonthMap).slice(-6);

    // ── Top Reviewed ──────────────────────────────────────────────────────────
    const topReviewedItems = topReviewed
      .filter((p) => p._count.reviews > 0)
      .map((p) => {
        const avg = p.reviews.reduce((s, r) => s + r.rating, 0) / (p.reviews.length || 1);
        return { name: p.name, count: p._count.reviews, avg: Math.round(avg * 10) / 10 };
      });

    // Active fulfillment count
    const activeFulfillmentCount = ordersByStatus
      .filter((s) => ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"].includes(s.status))
      .reduce((sum, s) => sum + s._count._all, 0);

    return {
      financials: {
        netRevenue,
        grossRevenue,
        totalRefundVolume,
        thisMonthNet: grossThisMonth,
        lastMonthNet: grossLastMonth,
        aov: aovAllTime,
        aovThisMonth,
        aovLastMonth,
      },
      orders: {
        settled: totalSettledOrders,
        thisMonth: ordersThisMonth,
        lastMonth: ordersLastMonth,
        activeFulfillment: activeFulfillmentCount,
        allCreated: allOrdersCount,
        cancelled: cancelledOrdersCount,
        refunded: refundedOrdersCount,
        pending: pendingOrdersCount,
        cancellationRate,
      },
      customers: {
        total: totalCustomers,
        thisMonth: customersThisMonth,
        lastMonth: customersLastMonth,
        members: totalMembers,
        membersThisMonth,
        membersLastMonth,
        penetrationRate: totalCustomers > 0 ? Math.round((totalMembers / totalCustomers) * 100) : 0,
      },
      catalog: {
        active: activeProductCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      },
      gateways: {
        payway: paywayOrderCount,
        stripe: stripeOrderCount,
      },
      fulfillmentDistribution: Object.entries(fulfillmentMap).map(([key, val]) => ({
        key,
        ...val,
      })),
      monthlyData,
      sparklineRevenue,
      customerSparkline,
      statusSegments,
      topProductItems,
      categoryItems,
      topReviewedItems,
    };
  });
}

function DeltaBadge({ current, previous, suffix = "% vs last mo" }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0 && current === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
        <Minus className="h-2.5 w-2.5" /> 0%
      </span>
    );
  }
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
        up ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct)}{suffix}
    </span>
  );
}

export default async function AdminAnalyticsPage() {
  const data = await getAnalyticsData();
  const {
    financials,
    orders,
    customers,
    catalog,
    gateways,
    fulfillmentDistribution,
    monthlyData,
    sparklineRevenue,
    customerSparkline,
    statusSegments,
    topProductItems,
    categoryItems,
    topReviewedItems,
  } = data;

  const kpiCards = [
    {
      label: "Net Settled Revenue",
      value: currencyFormatter.format(financials.netRevenue),
      sub: `${currencyFormatter.format(financials.thisMonthNet)} this month`,
      extra: `Gross: ${currencyFormatter.format(financials.grossRevenue)}`,
      icon: DollarSign,
      accent: "bg-emerald-600 text-white",
      delta: { current: financials.thisMonthNet, previous: financials.lastMonthNet },
      sparkline: sparklineRevenue,
      sparkColor: "#10b981",
    },
    {
      label: "Settled Orders",
      value: orders.settled.toLocaleString(),
      sub: `${orders.thisMonth} placed this month`,
      extra: `${orders.activeFulfillment} in fulfillment pipeline`,
      icon: ShoppingCart,
      accent: "bg-blue-600 text-white",
      delta: { current: orders.thisMonth, previous: orders.lastMonth },
      sparkline: monthlyData.slice(-6).map((d) => d.orders),
      sparkColor: "#3b82f6",
    },
    {
      label: "Average Order Value",
      value: currencyFormatter.format(financials.aov),
      sub: `${currencyFormatter.format(financials.aovThisMonth)} this month`,
      extra: "Strictly settled sales",
      icon: TrendingUp,
      accent: "bg-indigo-600 text-white",
      delta: { current: financials.aovThisMonth, previous: financials.aovLastMonth },
      sparkline: null,
      sparkColor: "#6366f1",
    },
    {
      label: "VIP Members",
      value: customers.members.toLocaleString(),
      sub: `${customers.penetrationRate}% of customer base`,
      extra: `+${customers.membersThisMonth} joined this month`,
      icon: Crown,
      accent: "bg-amber-500 text-white",
      delta: { current: customers.membersThisMonth, previous: customers.membersLastMonth },
      sparkline: customerSparkline,
      sparkColor: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Executive Analytics & Revenue
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Verified Settle Logic
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time business performance. Cancelled and unpaid test checkout attempts are 100% excluded from revenue metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {catalog.lowStock > 0 && (
            <Link
              href="/admin/products"
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>{catalog.lowStock} Low Stock</span>
            </Link>
          )}
          <Link
            href="/admin/orders"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 transition-opacity"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Fulfillment Queue ({orders.activeFulfillment})</span>
          </Link>
        </div>
      </div>

      {/* Financial Health & Operational Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gross Sales</p>
          <p className="mt-1 text-lg font-black text-foreground">{currencyDetailFormatter.format(financials.grossRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Paid checkouts</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Refunds</p>
          <p className={`mt-1 text-lg font-black ${financials.totalRefundVolume > 0 ? "text-amber-600" : "text-foreground"}`}>
            {currencyDetailFormatter.format(financials.totalRefundVolume)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{orders.refunded} order(s) refunded</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Net Revenue</p>
          <p className="mt-1 text-lg font-black text-emerald-600">{currencyDetailFormatter.format(financials.netRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Realized funds</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Fulfillment</p>
          <p className="mt-1 text-lg font-black text-blue-600">{orders.activeFulfillment}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Awaiting delivery</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cancellation Rate</p>
          <p className="mt-1 text-lg font-black text-rose-600">{orders.cancellationRate}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{orders.cancelled} cancelled orders</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer Base</p>
          <p className="mt-1 text-lg font-black text-violet-600">{customers.total.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">+{customers.thisMonth} new this month</p>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-none">
                    {card.value}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground mt-1.5">{card.extra}</p>
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.accent} shadow-sm`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="flex items-end justify-between gap-2 border-t border-border/60 pt-3">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-semibold text-foreground">{card.sub}</p>
                  <DeltaBadge current={card.delta.current} previous={card.delta.previous} />
                </div>
                {card.sparkline && card.sparkline.length >= 2 && (
                  <Sparkline data={card.sparkline} color={card.sparkColor} height={32} width={72} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 12-Month Trend Chart */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Revenue & Order Volume (Last 12 Months)</h2>
              <p className="text-[11px] text-muted-foreground">Aggregated strictly from settled and fulfilled customer orders</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              Settled Revenue (AUD)
            </span>
          </div>
        </div>
        <div className="p-6">
          <RevenueBarChart data={monthlyData} />
        </div>
      </div>

      {/* Fulfillment Distribution & Gateway Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fulfillment Channels */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Fulfillment Distribution</h3>
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">{orders.settled} settled</span>
          </div>
          <div className="space-y-3">
            {fulfillmentDistribution.map((item) => {
              const pct = orders.settled > 0 ? Math.round((item.count / orders.settled) * 100) : 0;
              const isDelivery = item.key === "DELIVERY";
              const isPickup = item.key === "STORE_PICKUP";
              const Icon = isPickup ? Store : Truck;
              return (
                <div key={item.key} className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Icon className={`h-3.5 w-3.5 ${isDelivery ? "text-blue-500" : isPickup ? "text-emerald-500" : "text-indigo-500"}`} />
                      {item.label}
                    </span>
                    <span className="text-foreground font-black">{currencyFormatter.format(item.revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{item.count} order{item.count !== 1 ? "s" : ""}</span>
                    <span className="font-bold text-foreground">{pct}% of sales</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isDelivery ? "bg-blue-500" : isPickup ? "bg-emerald-500" : "bg-indigo-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Gateways & Merchant Settlements */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Payment Settlement</h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Direct Westpac
            </span>
          </div>
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">Westpac PayWay</p>
                <p className="text-[10px] text-muted-foreground">Primary gateway (Cards & Apple Pay)</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-foreground">{gateways.payway} settled</p>
                <p className="text-[10px] font-semibold text-emerald-600">Active</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">Stripe / Legacy</p>
                <p className="text-[10px] text-muted-foreground">Historical transaction logs</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-foreground">{gateways.stripe} settled</p>
                <p className="text-[10px] text-muted-foreground">Archive</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1">
              <p className="text-[11px] font-bold text-blue-900">Settlement Verification</p>
              <p className="text-[10px] text-blue-700 leading-relaxed">
                Transactions settle directly into the configured Westpac merchant account. Cancelled orders are never charged or credited.
              </p>
            </div>
          </div>
        </div>

        {/* Catalog & Inventory Overview */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Catalog & Stock Health</h3>
            </div>
            <Link href="/admin/products" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/60">
              <span className="text-xs font-medium text-foreground">Active Listings</span>
              <span className="text-xs font-black text-foreground">{catalog.active} products</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/60 border border-amber-200/60">
              <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Low Stock (1–5 units)
              </span>
              <span className="text-xs font-black text-amber-700">{catalog.lowStock} products</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/60 border border-rose-200/60">
              <span className="text-xs font-semibold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> Out of Stock (0 units)
              </span>
              <span className="text-xs font-black text-rose-700">{catalog.outOfStock} products</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column: Order Status Donut + Top Products */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Order Status Distribution */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div>
              <h2 className="text-sm font-bold text-foreground">Order Status Distribution</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">All {orders.allCreated} lifetime checkout attempts</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                <CheckCircle2 className="h-3 w-3" /> {orders.settled} Settled
              </span>
            </div>
          </div>
          <div className="p-5">
            {statusSegments.length > 0 ? (
              <DonutChart
                segments={statusSegments}
                total={orders.allCreated}
                centerLabel="Total"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No order data found.</p>
            )}
          </div>
        </div>

        {/* Top Products by Revenue */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div>
              <h2 className="text-sm font-bold text-foreground">Top Products by Settled Revenue</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Calculated exclusively from paid order items (quantity × unit price)</p>
            </div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Top Performers</span>
          </div>
          <div className="p-5">
            {topProductItems.length > 0 ? (
              <HorizontalBarChart
                items={topProductItems}
                format="currency"
                colorClass="bg-primary"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No settled product sales yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Two-column: Category Revenue + Top Reviewed */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue by Category */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div>
              <h2 className="text-sm font-bold text-foreground">Revenue by Category</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sales contribution by department</p>
            </div>
            <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">Categories</span>
          </div>
          <div className="p-5">
            {categoryItems.length > 0 ? (
              <HorizontalBarChart
                items={categoryItems}
                format="currency"
                colorClass="bg-violet-600"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No category sales recorded yet.</p>
            )}
          </div>
        </div>

        {/* Top Reviewed Products */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div>
              <h2 className="text-sm font-bold text-foreground">Most Reviewed Products</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Customer feedback and ratings</p>
            </div>
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Social Proof</span>
          </div>
          <div className="p-5">
            {topReviewedItems.length > 0 ? (
              <div className="space-y-3">
                {topReviewedItems.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <span className="text-[11px] font-black text-muted-foreground w-4 shrink-0">{i + 1}</span>
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
                    <span className="text-xs font-bold text-foreground shrink-0">{p.count} review{p.count !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No customer reviews yet.</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
