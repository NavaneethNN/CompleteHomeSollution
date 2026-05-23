import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
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
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Server action to update order status
async function updateOrderStatus(orderId: string, newStatus: string) {
  "use server";
  
  try {
    await db.order.update({
      where: { id: orderId },
      data: { status: newStatus as any },
    });
    
    revalidatePath("/admin/orders");
    return { success: true };
  } catch (error) {
    console.error("Failed to update order status:", error);
    return { success: false, error: "Failed to update status" };
  }
}

export const metadata: Metadata = { title: "Manage Orders — Admin" };

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING:          { label: "Pending",          icon: Clock,          variant: "outline" },
  CONFIRMED:        { label: "Confirmed",        icon: CheckCircle2,   variant: "secondary" },
  PROCESSING:       { label: "Processing",       icon: Package,        variant: "default" },
  SHIPPED:          { label: "Shipped",          icon: Truck,          variant: "default" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", icon: Truck,          variant: "default" },
  DELIVERED:        { label: "Delivered",        icon: CheckCircle2,   variant: "secondary" },
  CANCELLED:        { label: "Cancelled",        icon: XCircle,        variant: "destructive" },
};

interface OrdersPageProps {
  searchParams: { 
    page?: string;
    status?: string;
    search?: string;
  };
}

const ORDERS_PER_PAGE = 20;

async function getOrders({ page = 1, status, search }: { page: number; status?: string; search?: string }) {
  const skip = (page - 1) * ORDERS_PER_PAGE;
  
  const where: any = {};
  
  if (status && status !== "ALL") {
    where.status = status;
  }
  
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [orders, totalCount] = await Promise.all([
    db.order.findMany({
      where,
      take: ORDERS_PER_PAGE,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        address: { select: { name: true } },
        items: {
          take: 1,
          include: {
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
  const [
    totalOrders,
    confirmedOrders,
    processingOrders,
    todayOrders,
    todayRevenue,
  ] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: "CONFIRMED" } }),
    db.order.count({ where: { status: "PROCESSING" } }),
    db.order.count({ 
      where: { 
        createdAt: { 
          gte: new Date(new Date().setHours(0, 0, 0, 0)) 
        } 
      } 
    }),
    db.order.aggregate({
      where: { 
        status: { not: "CANCELLED" },
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      },
      _sum: { total: true },
    }),
  ]);

  return {
    totalOrders,
    confirmedOrders,
    processingOrders,
    todayOrders,
    todayRevenue: todayRevenue._sum.total ?? 0,
  };
}

export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const status = searchParams.status;
  const search = searchParams.search;

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
      label: "Confirmed",
      mobileLabel: "Confirmed",
      value: stats.confirmedOrders.toLocaleString(),
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

  const statusOptions = ["ALL", "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

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
            <details className="sm:hidden relative">
              <summary className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg cursor-pointer list-none hover:bg-slate-200 transition-colors">
                <Filter className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">
                  {status || "ALL"}
                </span>
                <span className="text-xs text-slate-500">
                  ({status && status !== "ALL" ? "filtered" : "all"})
                </span>
              </summary>
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[150px] z-10">
                {statusOptions.map((s) => (
                  <Link
                    key={s}
                    href={`/admin/orders?page=1&status=${s}${search ? `&search=${search}` : ""}`}
                    className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                      (status || "ALL") === s
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </details>
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
                    const StatusConfig = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.PENDING;
                    const StatusIcon = StatusConfig.icon;
                    
                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <span className="font-mono text-xs text-slate-500">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
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
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 hidden sm:table-cell">
                          {new Date(order.createdAt).toLocaleDateString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-slate-900">
                          {currencyFormatter.format(order.total)}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <Badge variant={StatusConfig.variant} className="flex items-center gap-1 w-fit text-xs whitespace-nowrap">
                            <StatusIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">{StatusConfig.label}</span>
                          </Badge>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 hidden lg:table-cell">
                          {order.items?.length || 0} items
                          {order.items?.[0]?.product?.name && (
                            <p className="text-xs text-slate-500 truncate max-w-[120px]">
                              {order.items[0].product.name}
                              {(order.items?.length || 0) > 1 && "..."}
                            </p>
                          )}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            {/* Status Change Form */}
                            <form 
                              action={async (formData: FormData) => {
                                "use server";
                                const newStatus = formData.get("status") as string;
                                if (newStatus) await updateOrderStatus(order.id, newStatus);
                              }}
                              className="flex items-center gap-1"
                            >
                              <input type="hidden" name="orderId" value={order.id} />
                              <Select name="status" defaultValue={order.status}>
                                <SelectTrigger className="w-[100px] sm:w-[130px] h-8 text-xs">
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PENDING">Pending</SelectItem>
                                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                                  <SelectItem value="PROCESSING">Processing</SelectItem>
                                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                                  <SelectItem value="OUT_FOR_DELIVERY">Out for Delivery</SelectItem>
                                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button type="submit" size="sm" className="h-8 px-2 text-xs">
                                Update
                              </Button>
                            </form>
                            
                            <Link href={`/admin/orders/${order.id}`}>
                              <Button variant="ghost" size="sm" title="View full order details" className="px-2 sm:px-3">
                                <Eye className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                            </Link>
                          </div>
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
