import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getOrders } from "@/lib/actions/orders";
import {
  Package,
  ChevronRight,
  ShoppingBag,
  Calendar,
  MapPin,
  CreditCard,
  Truck,
  Box,
  Star,
} from "lucide-react";

export const metadata: Metadata = { title: "My Orders — Complete Home Sollution" };

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { orders, error } = await getOrders();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/account/dashboard" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">My Orders</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage your purchases
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                <Package className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground mb-1">No orders yet</p>
              <p className="text-sm text-muted-foreground mb-5">
                Your order history will appear here once you make a purchase.
              </p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
              >
                <ShoppingBag className="h-4 w-4" /> Start Shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                {/* Order Header */}
                <div className="px-6 py-4 border-b border-border bg-secondary/20">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Order #{order.id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(order.createdAt).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <span className={getStatusStyle(order.status)}>{getUserStatusLabel(order.status)}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">
                        ${order.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.items.length} {order.items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="px-6 py-4">
                  <div className="space-y-3">
                    {order.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                          {item.product.images?.[0] ? (
                            <img
                              src={item.product.images[0]}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Box className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/products/${item.product.slug}`}
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                          >
                            {item.product.name}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground shrink-0">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </p>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-20">
                        +{order.items.length - 3} more {order.items.length - 3 === 1 ? "item" : "items"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rating Section - Only for Delivered Orders */}
                {order.status === "DELIVERED" && (
                  <div className="px-6 py-3 border-t border-border bg-amber-50/50">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm text-foreground font-medium">How was your order?</span>
                      </div>
                      <Link
                        href={`/account/orders/${order.id}/rate`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 hover:text-amber-700 hover:underline"
                      >
                        Rate Order <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Order Footer */}
                <div className="px-6 py-4 border-t border-border bg-secondary/10">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate max-w-[200px]">
                        {order.address.suburb}, {order.address.state} {order.address.postcode}
                      </span>
                    </div>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      View Details <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to get user-friendly status labels
function getUserStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Order Placed",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };
  return labels[status] || status;
}

// Helper function to get status badge styles
function getStatusStyle(status: string): string {
  const baseClasses = "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide";

  switch (status) {
    case "PENDING":
      return `${baseClasses} bg-amber-100 text-amber-700`;
    case "CONFIRMED":
      return `${baseClasses} bg-blue-100 text-blue-700`;
    case "PROCESSING":
      return `${baseClasses} bg-purple-100 text-purple-700`;
    case "SHIPPED":
      return `${baseClasses} bg-indigo-100 text-indigo-700`;
    case "OUT_FOR_DELIVERY":
      return `${baseClasses} bg-orange-100 text-orange-700`;
    case "DELIVERED":
      return `${baseClasses} bg-emerald-100 text-emerald-700`;
    case "CANCELLED":
      return `${baseClasses} bg-red-100 text-red-700`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-700`;
  }
}
