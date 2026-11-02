"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Package,
  Calendar,
  Store,
  Clock,
  CheckCircle2,
  Box,
  ChevronRight,
  User,
  LogIn,
  Search,
  AlertCircle,
  Loader2,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { getGuestOrdersFromSession, saveGuestOrderToSession, type SessionGuestOrder } from "@/lib/guest-session";
import { getGuestSessionOrders, lookupGuestOrder } from "@/lib/guest-orders";
import type { OrderWithItems } from "@/lib/actions/orders";
import { orderContentsLabel, getEffectiveOrderStatus } from "@/lib/order-display";
import { OrderMembershipItem } from "@/components/account/order-membership-item";
import { BuyAgainButton } from "@/components/shop/buy-again-button";

export function GuestOrdersView() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [guestTokens, setGuestTokens] = useState<SessionGuestOrder[]>([]);
  const [lookupOpen, setLookupOpen] = useState(false);

  // Order lookup form state
  const [orderQuery, setOrderQuery] = useState("");
  const [emailQuery, setEmailQuery] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load session orders on mount
  useEffect(() => {
    async function loadOrders() {
      try {
        const stored = getGuestOrdersFromSession();
        setGuestTokens(stored);

        if (stored.length > 0) {
          const res = await getGuestSessionOrders(
            stored.map((s) => ({ orderId: s.orderId, guestToken: s.guestToken }))
          );
          if (res.orders && res.orders.length > 0) {
            setOrders(res.orders);
          }
        }
      } catch (err) {
        console.error("Failed to load guest session orders:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);

    if (!orderQuery.trim()) {
      setLookupError("Please enter your Order Number.");
      return;
    }
    if (!emailQuery.trim() || !emailQuery.includes("@")) {
      setLookupError("Please enter a valid email address.");
      return;
    }

    startTransition(async () => {
      const res = await lookupGuestOrder(orderQuery, emailQuery);
      if (!res.success || !res.order) {
        setLookupError(res.error || "No order found matching those details.");
        return;
      }

      // Save found order to session
      if (res.guestToken) {
        saveGuestOrderToSession({
          orderId: res.order.id,
          guestToken: res.guestToken,
          email: res.order.guestEmail || emailQuery,
        });
      }

      // Add to display orders without duplicate
      setOrders((prev) => [
        res.order!,
        ...prev.filter((o) => o.id !== res.order!.id),
      ]);
      setLookupOpen(false);
      setOrderQuery("");
    });
  };

  const primaryGuestEmail = orders[0]?.guestEmail || guestTokens[0]?.email || "";

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-border p-12 flex flex-col items-center justify-center text-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
        <p className="text-sm font-semibold text-foreground">Retrieving session order history...</p>
        <p className="text-xs text-muted-foreground mt-1">Checking for purchases made in this browser session</p>
      </div>
    );
  }

  // Case 1: Customer has orders in this browser session
  if (orders.length > 0) {
    return (
      <div className="space-y-6">
        {/* Temporary Session Notice & Account Linking Guide */}
        <div className="bg-white rounded-2xl border border-primary/20 shadow-sm p-6 overflow-hidden relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-1">
                <Clock className="h-3.5 w-3.5" />
                Browser Session History
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Orders placed in this session
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You are viewing {orders.length} order{orders.length === 1 ? "" : "s"} placed as{" "}
                <strong className="text-foreground">{primaryGuestEmail || "Guest"}</strong>. 
                These orders will be cleared when your browser session closes.
              </p>
              <p className="text-xs text-primary font-medium flex items-center gap-1.5 pt-0.5">
                <Sparkles className="h-3.5 w-3.5" />
                Sign in with Google or your email below to permanently link these orders to your account.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/account/orders" })}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-white text-foreground text-xs font-bold hover:bg-secondary transition-colors shadow-sm"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>

              <Link
                href={`/login?email=${encodeURIComponent(primaryGuestEmail)}&callbackUrl=/account/orders`}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In with Email
              </Link>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.map((order) => {
            const effectiveStatus = getEffectiveOrderStatus(order);
            const isStorePickup = order.fulfillmentType === "STORE_PICKUP";
            const token = guestTokens.find((t) => t.orderId === order.id)?.guestToken;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                {/* Header */}
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

                  {/* Store Pickup Banner */}
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

                {/* Items */}
                <div className="px-6 py-4">
                  <div className="space-y-3">
                    <OrderMembershipItem amount={order.membershipAmount} durationDays={order.membershipDurationDays} />
                    {order.items.slice(0, 3).map((item) => {
                      const displayImage = item.productVariant?.images?.[0]?.url ?? item.product.images?.[0];
                      const variantLabel = item.productVariant?.values?.map((v) => v.variantValue.value).join(" / ") || null;
                      return (
                        <div key={item.id} className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                            {displayImage ? (
                              <img src={displayImage} alt={item.product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Box className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/products/${item.product.slug}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-1">
                              {item.product.name}
                            </Link>
                            {variantLabel && <p className="text-xs text-muted-foreground mt-0.5">{variantLabel}</p>}
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
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-3 border-t border-border bg-secondary/10 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-xs text-muted-foreground">
                    {order.fulfillmentType === "STORE_PICKUP"
                      ? "Showroom Collection: Golden Grove SA 5125"
                      : `${order.address.suburb}, ${order.address.state} ${order.address.postcode}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <BuyAgainButton items={order.items} />
                    <Link
                      href={token ? `/account/orders/${order.id}?token=${encodeURIComponent(token)}` : `/account/orders/${order.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/5"
                    >
                      View Details <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Track Another Order Button / Form */}
        <div className="border border-border bg-white rounded-2xl p-5">
          {!lookupOpen ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Have another order placed in a different browser?</p>
                <p className="text-xs text-muted-foreground">Look up any guest order using its order number and email.</p>
              </div>
              <button
                type="button"
                onClick={() => setLookupOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-secondary transition-colors"
              >
                <Search className="h-3.5 w-3.5" /> Look Up Another Order
              </button>
            </div>
          ) : (
            <form onSubmit={handleLookupSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Look Up Guest Order</h3>
                <button
                  type="button"
                  onClick={() => setLookupOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>

              {lookupError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Order Number</label>
                  <input
                    type="text"
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    placeholder="e.g. #ABC12345"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Email Address</label>
                  <input
                    type="email"
                    value={emailQuery}
                    onChange={(e) => setEmailQuery(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Find Order
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Case 2: No orders currently in browser session — show Account Sign-In + Guest Order Lookup
  return (
    <div className="space-y-6">
      {/* Sign In & Account Creation Card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
        <div className="max-w-xl mx-auto text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
            <User className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Sign In to View Your Orders</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sign in with Google or your email account to view your past purchases, track active shipments, and manage your membership.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/account/orders" })}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-white text-foreground text-sm font-bold hover:bg-secondary transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Sign In with Google
            </button>

            <Link
              href="/login?callbackUrl=/account/orders"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <LogIn className="h-4 w-4" />
              Sign In with Email
            </Link>
          </div>

          <div className="pt-2">
            <span className="text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register?callbackUrl=/account/orders" className="font-semibold text-primary hover:underline">
                Create one now
              </Link>
            </span>
          </div>
        </div>
      </div>

      {/* Track a Guest Order Lookup Card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-2.5 mb-2">
            <Search className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Track a Guest Order</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Placed an order without signing in? Enter your Order Number and Email to retrieve your order details in this browser session.
          </p>

          <form onSubmit={handleLookupSubmit} className="space-y-4">
            {lookupError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{lookupError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Order Number
                </label>
                <input
                  type="text"
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  placeholder="e.g. #ABC12345"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={emailQuery}
                  onChange={(e) => setEmailQuery(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Retrieve Order
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
