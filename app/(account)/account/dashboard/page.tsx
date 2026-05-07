import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrderStats } from "@/lib/actions/orders";
import { getAddresses } from "@/lib/actions/address";
import { AccountSidebar } from "@/components/account/account-sidebar";
import {
  Package, Crown, ShoppingBag, Heart, ChevronRight, ArrowRight,
  Star, Truck, ShieldCheck, Tag, Calendar, MapPin, ChevronLeft, Home,
} from "lucide-react";

export const metadata: Metadata = { title: "My Dashboard — Complete Home Sollution" };

const QUICK_ACTIONS = [
  {
    Icon: ShoppingBag,
    title: "Browse Products",
    desc: "Explore our full range of premium furniture",
    href: "/products",
    color: "bg-primary/10 text-primary",
  },
  {
    Icon: Package,
    title: "My Orders",
    desc: "Track and manage your recent orders",
    href: "/account/orders",
    color: "bg-blue-50 text-blue-600",
  },
  {
    Icon: Crown,
    title: "Membership",
    desc: "Unlock exclusive discounts up to 30% off",
    href: "/account/membership",
    color: "bg-amber-50 text-amber-600",
  },
  {
    Icon: MapPin,
    title: "Saved Addresses",
    desc: "Manage your delivery addresses",
    href: "/account/addresses",
    color: "bg-emerald-50 text-emerald-600",
  },
] as const;

const PERKS = [
  { Icon: Tag,          text: "Up to 30% member-only pricing" },
  { Icon: Truck,        text: "Fast Australia-wide delivery" },
  { Icon: ShieldCheck,  text: "Secure, encrypted checkout" },
  { Icon: Star,         text: "Priority customer support" },
] as const;

export default async function AccountDashboardPage() {
  const session = await auth();
  const user = session!.user;
  
  // Fetch dynamic data
  const [{ totalOrders, pendingOrders, recentOrders }, { addresses }, cartItems] = await Promise.all([
    getOrderStats(),
    getAddresses(),
    db.cartItem.count({ where: { userId: user.id } }),
  ]);
  
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? "U").toUpperCase();
  
  const addressCount = addresses?.length || 0;
  const cartCount = cartItems || 0;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-4 lg:py-12">
        {/* Breadcrumb / Back Navigation */}
        <div className="flex items-center gap-2 mb-4 lg:mb-6">
          <Link 
            href="/" 
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Shop</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <span className="text-muted-foreground">·</span>
          <div className="flex items-center gap-1.5 text-sm">
            <Home className="h-3.5 w-3.5 text-muted-foreground" />
            <Link href="/account/dashboard" className="text-foreground font-medium hover:text-primary transition-colors">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* ── Sidebar (desktop only) ───────────────── */}
          <AccountSidebar user={user} />

          {/* ── Main content ─────────────────────────── */}
          <main className="flex-1 min-w-0 space-y-4 lg:space-y-6">

            {/* Welcome banner - Premium gradient for mobile */}
            <div className="relative rounded-2xl p-6 lg:p-7 xl:p-9 text-white overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-primary/90">
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/10" />
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/30 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium backdrop-blur-sm">
                    <Crown className="h-3 w-3" />
                    {user.isMember ? "Member" : "Guest"}
                  </span>
                </div>
                <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold mb-2">
                  Welcome back, {user.name?.split(" ")[0] ?? "Friend"} 👋
                </h1>
                <p className="text-white/70 text-sm max-w-md leading-relaxed">
                  {user.isMember
                    ? "You're a valued member. Enjoy your exclusive discounts on every order."
                    : "Upgrade to membership and save up to 30% on every order."}
                </p>
                {!user.isMember && (
                  <Link
                    href="/account/membership"
                    className="inline-flex items-center gap-2 mt-4 bg-white text-primary hover:bg-white/90 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg"
                  >
                    <Crown className="h-4 w-4" /> Become a Member
                  </Link>
                )}
              </div>
            </div>

            {/* Stats row - better mobile styling */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {[
                { label: "Orders",         value: totalOrders.toString(),    Icon: Package,      color: "text-blue-600",   bg: "bg-blue-50",   sublabel: "Total" },
                { label: "Cart",           value: cartCount.toString(),      Icon: ShoppingBag,  color: "text-rose-500",   bg: "bg-rose-50",   sublabel: "Items" },
                { label: "Addresses",      value: addressCount.toString(),   Icon: MapPin,       color: "text-emerald-600",bg: "bg-emerald-50",sublabel: "Saved" },
                { label: "Status",         value: user.isMember ? "Active" : "—", Icon: Crown, color: "text-amber-600", bg: "bg-amber-50",  sublabel: "Member" },
              ].map(({ label, value, Icon, color, bg, sublabel }) => (
                <div key={label} className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 lg:block">
                    <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 lg:h-5 lg:w-5 ${color}`} />
                    </div>
                    <div className="lg:mt-2">
                      <p className="text-xl lg:text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{sublabel}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick actions - better mobile touch targets */}
            <div>
              <h2 className="text-sm lg:text-base font-bold text-foreground mb-3 lg:mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                {QUICK_ACTIONS.map(({ Icon, title, desc, href, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group bg-white rounded-xl lg:rounded-2xl p-4 lg:p-5 border border-border shadow-sm hover:shadow-md hover:border-primary/30 active:scale-[0.98] transition-all duration-200 flex items-center gap-3 lg:gap-4"
                  >
                    <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-lg lg:rounded-xl ${color} flex items-center justify-center shrink-0`}>
                      <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed hidden sm:block">{desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Membership upgrade card — non-members only */}
            {!user.isMember && (
              <div className="bg-white rounded-xl lg:rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-4 lg:px-6 py-4 lg:py-5 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-sm lg:text-base text-foreground">Unlock Member Perks</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Join thousands of Australians saving on premium furniture</p>
                  </div>
                  <Crown className="h-5 w-5 lg:h-6 lg:w-6 text-amber-500 shrink-0" />
                </div>
                <div className="p-4 lg:p-6 grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
                  {PERKS.map(({ Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 lg:gap-3 text-xs lg:text-sm text-foreground">
                      <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-3 w-3 lg:h-3.5 lg:w-3.5 text-primary" />
                      </div>
                      <span className="leading-tight">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 lg:px-6 pb-4 lg:pb-6">
                  <Link
                    href="/account/membership"
                    className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white font-semibold text-sm py-2.5 lg:py-3 rounded-xl transition-colors"
                  >
                    <Crown className="h-4 w-4" /> View Membership Plans
                  </Link>
                </div>
              </div>
            )}

            {/* Recent Orders */}
            <div className="bg-white rounded-xl lg:rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 lg:px-6 py-4 lg:py-5 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-sm lg:text-base text-foreground">Recent Orders</h2>
                <Link href="/account/orders" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              
              {recentOrders.length === 0 ? (
                <div className="px-4 lg:px-6 py-10 lg:py-14 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-secondary flex items-center justify-center mb-3 lg:mb-4">
                    <Package className="h-6 w-6 lg:h-7 lg:w-7 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-foreground mb-1">No orders yet</p>
                  <p className="text-xs lg:text-sm text-muted-foreground mb-4 lg:mb-5">Your orders will appear here once you make a purchase.</p>
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl transition-colors"
                  >
                    <ShoppingBag className="h-4 w-4" /> Start Shopping
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/account/orders/${order.id}`}
                      className="flex items-center gap-3 lg:gap-4 px-4 lg:px-6 py-3 lg:py-4 hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
                    >
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-foreground">#{order.id.slice(-6).toUpperCase()}</span>
                          <span className={getStatusStyle(order.status)}>{order.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.items.length} {order.items.length === 1 ? "item" : "items"} · {new Date(order.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm text-foreground">${order.total.toFixed(2)}</p>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}

// Helper function to get status badge styles
function getStatusStyle(status: string): string {
  const baseClasses = "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide";
  
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
