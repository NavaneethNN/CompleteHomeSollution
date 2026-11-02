import { OrderMembershipItem } from "@/components/account/order-membership-item";
import { orderContentsLabel, getEffectiveOrderStatus } from "@/lib/order-display";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getOrders } from "@/lib/actions/orders";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { BuyAgainButton } from "@/components/shop/buy-again-button";
import { GuestOrdersView } from "@/components/account/guest-orders-view";
import {
  Package,
  ChevronRight,
  ShoppingBag,
  Calendar,
  MapPin,
  Box,
  ChevronLeft,
  Home,
  Store,
  Clock,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = { title: "My Orders — Complete Home Sollution" };

export default async function OrdersPage() {
  const session = await auth();

  // If unauthenticated, display session guest orders and order retrieval tools
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-12">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 mb-6">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-sm">
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground font-semibold text-sm">Order History</span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Order History</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track orders placed in this browser session, or sign in with your email or Google account to view your permanent history.
            </p>
          </div>

          <GuestOrdersView />
        </div>
      </div>
    );
  }

  const { orders, error } = await getOrders();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-4 lg:py-12">
        {/* Breadcrumb / Back Navigation */}
        <div className="flex items-center gap-2 mb-4 lg:mb-6">
          <Link 
            href="/account/dashboard" 
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <span className="text-muted-foreground">·</span>
          <div className="flex items-center gap-1.5 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Link href="/account/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground font-semibold">My Orders</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <AccountSidebar user={session.user} />

          {/* Main Content */}
          <main className="flex-1 min-w-0">

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
                {orders.map((order) => {
                  const effectiveStatus = getEffectiveOrderStatus(order);
                  const isStorePickup = order.fulfillmentType === "STORE_PICKUP";

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
                    >
                      {/* Order Header */}
                      <div className="px-6 py-4 border-b border-border bg-secondary/20">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {order.membershipAmount > 0 && order.items.length === 0 ? "Membership" : "Order"} #{order.id.slice(-8).toUpperCase()}
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
                            <div className="flex items-center gap-2 flex-wrap">
                              {isStorePickup && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full uppercase tracking-wide">
                                  <Store className="h-3 w-3 text-slate-600" />
                                  Store Pickup
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border ${effectiveStatus.badgeStyle}`}>
                                {effectiveStatus.label}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-foreground">
                              ${order.total.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {orderContentsLabel(order)}
                            </p>
                          </div>
                        </div>

                        {/* Store Pickup Appointment & Readiness Detailed Badge Banner */}
                        {isStorePickup && order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
                          <div className="mt-3 pt-3 border-t border-border/60">
                            {effectiveStatus.isAppointmentScheduled && effectiveStatus.appointmentFormatted ? (
                              <div className="px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-border flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2.5 text-xs text-foreground font-medium">
                                  <div className="w-6 h-6 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
                                    <Calendar className="h-3.5 w-3.5" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-foreground">Pickup Appointment:</span>{" "}
                                    <span className="text-muted-foreground">{effectiveStatus.appointmentFormatted}</span>
                                  </div>
                                </div>
                                <span className="text-[11px] font-semibold text-foreground bg-white px-2.5 py-0.5 rounded-lg border border-border shrink-0">
                                  Confirmed Slot
                                </span>
                              </div>
                            ) : effectiveStatus.isReadyForPickup ? (
                              <div className="px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-border flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2.5 text-xs text-foreground font-medium">
                                  <div className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-foreground">Ready for Collection:</span>{" "}
                                    <span className="text-muted-foreground">Your items are packed and waiting for you at the showroom.</span>
                                  </div>
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                                  Ready for Pickup
                                </span>
                              </div>
                            ) : effectiveStatus.isPickedUp ? (
                              <div className="px-3.5 py-2 rounded-xl bg-secondary/50 border border-border flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span>Order has been collected and completed from the showroom.</span>
                              </div>
                            ) : (
                              <div className="px-3.5 py-2 rounded-xl bg-secondary/50 border border-border flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>
                                  <strong className="text-foreground">Appointment Pending:</strong> Our showroom team will contact you to coordinate your preferred pickup date &amp; time.
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    {/* Order Items */}
                    <div className="px-6 py-4">
                      <div className="space-y-3">
                        <OrderMembershipItem amount={order.membershipAmount} durationDays={order.membershipDurationDays} />
                        {order.items.slice(0, 3).map((item) => {
                          const displayImage =
                            item.productVariant?.images?.[0]?.url ?? item.product.images?.[0];
                          const variantLabel =
                            item.productVariant?.values
                              ?.map((v) => v.variantValue.value)
                              .join(" / ") || null;
                          return (
                          <div key={item.id} className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                              {displayImage ? (
                                <img
                                  src={displayImage}
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
                              {variantLabel && (
                                <p className="text-xs text-muted-foreground mt-0.5">{variantLabel}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-foreground shrink-0">
                              ${(item.quantity * item.unitPrice).toFixed(2)}
                            </p>
                          </div>
                          );
                        })}
                        {order.items.length > 3 && (
                          <p className="text-xs text-muted-foreground pl-20">
                            +{order.items.length - 3} more {order.items.length - 3 === 1 ? "item" : "items"}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Order Footer */}
                    <div className="px-6 py-4 border-t border-border bg-secondary/10">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {isStorePickup ? (
                            <>
                              <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-semibold text-foreground">Showroom Collection: Golden Grove SA 5125</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="h-4 w-4 shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {order.membershipAmount > 0 && order.items.length === 0 ? "Digital membership" : `${order.address.suburb}, ${order.address.state} ${order.address.postcode}`}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {order.status === "PENDING" ? (
                            <Link
                              href={`/order-confirmation/${order.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2 transition-colors"
                            >
                              Complete Payment
                            </Link>
                          ) : (
                            <BuyAgainButton items={order.items} variant="outline" size="sm" />
                          )}
                          <Link
                            href={`/account/orders/${order.id}`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                          >
                            View Details <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// Helper function to get status badge styles
function getStatusStyle(status: string): string {
  const baseClasses = "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide";

  switch (status) {
    case "PENDING":
      return `${baseClasses} bg-amber-100 text-amber-700`;
    case "PAID":
      return `${baseClasses} bg-blue-100 text-blue-700`;
    case "PROCESSING":
      return `${baseClasses} bg-purple-100 text-purple-700`;
    case "SHIPPED":
      return `${baseClasses} bg-indigo-100 text-indigo-700`;
    case "DELIVERED":
      return `${baseClasses} bg-emerald-100 text-emerald-700`;
    case "CANCELLED":
      return `${baseClasses} bg-red-100 text-red-700`;
    case "REFUNDED":
      return `${baseClasses} bg-gray-100 text-gray-700`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-700`;
  }
}
