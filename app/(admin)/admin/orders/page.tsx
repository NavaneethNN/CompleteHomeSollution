import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";
import {
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  CreditCard,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MobileStatusDropdown } from "@/components/admin/mobile-status-dropdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


export const metadata: Metadata = { title: "Manage Orders — Admin" };

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  PENDING:          { label: "Pending",          icon: Clock,          variant: "outline",     className: "border-amber-300 text-amber-700 bg-amber-50" },
  PAID:             { label: "Paid",             icon: CreditCard,     variant: "outline",     className: "border-blue-300 text-blue-700 bg-blue-50" },
  CONFIRMED:        { label: "Confirmed",        icon: CheckCircle2,   variant: "outline",     className: "border-teal-300 text-teal-700 bg-teal-50" },
  PROCESSING:       { label: "Processing",       icon: Package,        variant: "outline",     className: "border-indigo-300 text-indigo-700 bg-indigo-50" },
  SHIPPED:          { label: "Shipped",          icon: Truck,          variant: "outline",     className: "border-purple-300 text-purple-700 bg-purple-50" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", icon: Truck,          variant: "outline",     className: "border-violet-300 text-violet-700 bg-violet-50" },
  DELIVERED:        { label: "Delivered",        icon: CheckCircle2,   variant: "outline",     className: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  CANCELLED:        { label: "Cancelled",        icon: XCircle,        variant: "destructive", className: "border-red-300 text-red-700 bg-red-50" },
  REFUNDED:         { label: "Refunded",         icon: RefreshCw,      variant: "outline",     className: "border-slate-300 text-slate-600 bg-slate-50" },
};

interface OrdersPageProps {
  searchParams: Promise<{ 
    page?: string;
    status?: string;
    search?: string;
  }>;
}

const ORDERS_PER_PAGE = 20;

async function getOrders({ page = 1, status, search }: { page: number; status?: string; search?: string }) {
  const skip = (page - 1) * ORDERS_PER_PAGE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    // Exclude pending orders (payment not completed)
    status: { not: "PENDING" },
  };

  if (status && status !== "ALL") {
    where.status = status as OrderStatus;
  }

  if (search) {
    // S-7: Clamp search input to 100 chars before hitting the database
    const safeSearch = search.slice(0, 100);
    where.OR = [
      { id: { contains: safeSearch, mode: "insensitive" } },
      { user: { name: { contains: safeSearch, mode: "insensitive" } } },
      { user: { email: { contains: safeSearch, mode: "insensitive" } } },
    ];
  }

  const [orders, totalCount] = await Promise.all([
    db.order.findMany({
      where,
      take: ORDERS_PER_PAGE,
      skip,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        refundRequested: true,
        user: { select: { id: true, name: true, email: true } },
        address: { select: { name: true } },
        items: {
          take: 1,
          select: {
            product: { select: { name: true } },
          },
        },
      },
    }),
    db.order.count({ where }),
  ]);

  return { orders, totalCount, totalPages: Math.ceil(totalCount / ORDERS_PER_PAGE) };
}

async function getOrderStats() {
  // P-3: Replaced 5 separate COUNT queries with a single groupBy aggregation,
  // then derive all counts from that one result set.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [statusGroups, todayStats] = await Promise.all([
    // One query returns counts for every status
    db.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // Separate query for today's count + revenue (needs date filter)
    db.order.aggregate({
      where: {
        createdAt: { gte: todayStart },
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count._all])
  );

  const totalOrders = statusGroups.reduce((acc, g) => acc + g._count._all, 0);

  const paidStatuses = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
  const paidOrders = paidStatuses.reduce((acc, s) => acc + (countByStatus[s] ?? 0), 0);
  const processingOrders = countByStatus["PROCESSING"] ?? 0;

  return {
    totalOrders,
    paidOrders,
    processingOrders,
    todayOrders: todayStats._count._all,
    todayRevenue: todayStats._sum.total ?? 0,
  };
}

export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const { page: pageParam, status, search } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10));

  const [{ orders, totalCount, totalPages }, stats] = await Promise.all([
    getOrders({ page, status, search }),
    getOrderStats(),
  ]);

  const statCards = [
    {
      label: "Total",
      mobileLabel: "Orders",
      value: stats.totalOrders.toLocaleString(),
      icon: ShoppingCart,
      accent: "bg-blue-500",
    },
    {
      label: "Paid",
      mobileLabel: "Paid",
      value: stats.paidOrders.toLocaleString(),
      icon: CheckCircle2,
      accent: "bg-emerald-500",
    },
    {
      label: "Processing",
      mobileLabel: "Process",
      value: stats.processingOrders.toLocaleString(),
      icon: Package,
      accent: "bg-indigo-500",
    },
    {
      label: "Today",
      mobileLabel: "Today",
      sub: currencyFormatter.format(stats.todayRevenue),
      value: stats.todayOrders.toLocaleString(),
      icon: TrendingUp,
      accent: "bg-emerald-500",
    },
  ];

  const statusOptions = ["ALL", "PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED"];

  return (
    <div className="space-y-6 p-4 sm:p-6 w-full max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500">Manage and track customer orders</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="w-full">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className={`${card.accent} p-2 rounded-lg shrink-0`}>
                  <card.icon className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-slate-500 truncate leading-tight">
                    <span className="sm:hidden">{card.mobileLabel}</span>
                    <span className="hidden sm:inline">{card.label}</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900">{card.value}</p>
                  {card.sub && <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">{card.sub}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="w-full">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            {/* Search Form */}
            <form className="flex gap-2" action="/admin/orders">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  name="search"
                  defaultValue={search}
                  placeholder="Search orders..."
                  className="pl-9"
                />
              </div>
              <input type="hidden" name="status" value={status || "ALL"} />
              <Button type="submit" variant="secondary" size="sm" className="shrink-0">
                <Search className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Search</span>
              </Button>
            </form>
            
            {/* Status Filter - Desktop */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-sm text-slate-500 shrink-0">Status:</span>
              <div className="flex gap-1 flex-wrap">
                {statusOptions.map((s) => (
                  <Link
                    key={s}
                    href={`/admin/orders?page=1&status=${s}${search ? `&search=${search}` : ""}`}
                    className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                      (status || "ALL") === s
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
            
            {/* Status Filter - Mobile Dropdown */}
            <Suspense fallback={null}>
              <MobileStatusDropdown 
                currentStatus={status || "ALL"}
                statusOptions={statusOptions}
              />
            </Suspense>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            Orders ({totalCount.toLocaleString()})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-medium text-slate-600 text-xs sm:text-sm">Order</th>
                  <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-medium text-slate-600 text-xs sm:text-sm">Customer</th>
                  <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-medium text-slate-600 text-xs sm:text-sm hidden sm:table-cell">Date</th>
                  <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-medium text-slate-600 text-xs sm:text-sm">Total</th>
                  <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-medium text-slate-600 text-xs sm:text-sm">Status</th>
                  <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-medium text-slate-600 text-xs sm:text-sm hidden lg:table-cell">Items</th>
                  <th className="py-2 sm:py-3 px-2 sm:px-4 text-right font-medium text-slate-600 text-xs sm:text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 px-4 text-center text-slate-500">
                      <ShoppingCart className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                      <p>No orders found</p>
                      {search && <p className="text-sm mt-1">Try adjusting your search</p>}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const StatusConfig = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.PAID;
                    const StatusIcon = StatusConfig.icon;
                    const hasRefundRequest = order.refundRequested && order.status !== "REFUNDED";
                    
                    return (
                      <tr key={order.id} className="hover:bg-slate-50 relative group">
                        {/* Clickable overlay for entire row */}
                        <td className="p-0">
                          <Link 
                            href={`/admin/orders/${order.id}`} 
                            className="absolute inset-0 z-0"
                            aria-hidden="true"
                          />
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 relative z-10">
                          <span className="font-mono text-xs text-slate-500">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 relative z-10">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                              <Users className="h-4 w-4 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">
                                {order.user?.name || "Guest"}
                              </p>
                              <p className="text-xs text-slate-500 truncate hidden sm:block">
                                {order.user?.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 hidden sm:table-cell relative z-10">
                          {new Date(order.createdAt).toLocaleDateString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-slate-900 relative z-10">
                          {currencyFormatter.format(order.total)}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 relative z-10">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold w-fit whitespace-nowrap ${StatusConfig.className}`}>
                              <StatusIcon className="h-3 w-3" />
                              {StatusConfig.label}
                            </span>
                            {hasRefundRequest && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full w-fit">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Refund Req.
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 hidden lg:table-cell relative z-10">
                          {order.items?.length || 0} items
                          {order.items?.[0]?.product?.name && (
                            <p className="text-xs text-slate-500 truncate max-w-[120px]">
                              {order.items[0].product.name}
                              {(order.items?.length || 0) > 1 && "..."}
                            </p>
                          )}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-right relative z-10">
                          <Link href={`/admin/orders/${order.id}`}>
                            <Button variant="ghost" size="sm" title="View full order details" className="px-2 sm:px-3 cursor-pointer relative z-10">
                              <Eye className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">View</span>
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 sm:py-4 border-t border-slate-200">
              <p className="text-xs sm:text-sm text-slate-500 text-center sm:text-left">
                Showing {(page - 1) * ORDERS_PER_PAGE + 1}-{" "}
                {Math.min(page * ORDERS_PER_PAGE, totalCount)} of{" "}
                {totalCount.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  href={`/admin/orders?page=${Math.max(1, page - 1)}${status && status !== "ALL" ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <Button variant="outline" size="sm" disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                </Link>
                <span className="text-sm text-slate-600 px-1 sm:px-2">
                  {page}/{totalPages}
                </span>
                <Link
                  href={`/admin/orders?page=${Math.min(totalPages, page + 1)}${status && status !== "ALL" ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                >
                  <Button variant="outline" size="sm" disabled={page >= totalPages}>
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4 sm:ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
