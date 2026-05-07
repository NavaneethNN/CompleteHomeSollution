import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import {
  LayoutDashboard, Package, Crown, UserCircle, MapPin,
  ShoppingBag, Heart, ChevronRight, ArrowRight,
  Star, Truck, ShieldCheck, Tag,
} from "lucide-react";

export const metadata: Metadata = { title: "My Dashboard — Complete Home Sollution" };

const NAV_LINKS = [
  { label: "Dashboard",   href: "/account/dashboard",  Icon: LayoutDashboard },
  { label: "My Orders",   href: "/account/orders",     Icon: Package },
  { label: "Membership",  href: "/account/membership", Icon: Crown },
  { label: "Profile",     href: "/account/profile",    Icon: UserCircle },
  { label: "Addresses",   href: "/account/addresses",  Icon: MapPin },
] as const;

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
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Sidebar ──────────────────────────────────────────── */}
          <aside className="lg:w-60 xl:w-64 shrink-0">
            {/* Avatar card */}
            <div
              className="rounded-2xl p-6 mb-4 flex flex-col items-center text-center text-white"
              style={{ backgroundColor: "var(--navy)" }}
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name ?? ""}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-white/20 mb-3"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center ring-4 ring-white/20 mb-3">
                  <span className="text-2xl font-black text-white">{initials}</span>
                </div>
              )}
              <p className="font-bold text-base leading-tight">{user.name ?? "Welcome"}</p>
              <p className="text-white/55 text-xs mt-0.5 truncate max-w-full">{user.email}</p>
              {user.isMember && (
                <span className="mt-3 inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 text-[11px] font-bold px-3 py-1 rounded-full">
                  <Crown className="h-3 w-3" /> MEMBER
                </span>
              )}
            </div>

            {/* Nav links */}
            <nav className="bg-white rounded-2xl overflow-hidden border border-border shadow-sm">
              {NAV_LINKS.map(({ label, href, Icon }, i) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors group
                    ${href === "/account/dashboard"
                      ? "bg-primary/8 text-primary border-l-[3px] border-primary"
                      : "text-foreground hover:bg-secondary hover:text-primary border-l-[3px] border-transparent"}
                    ${i !== 0 ? "border-t border-border" : ""}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </nav>
          </aside>

          {/* ── Main content ─────────────────────────────────────── */}
          <main className="flex-1 min-w-0 space-y-6">

            {/* Welcome banner */}
            <div
              className="rounded-2xl p-7 xl:p-9 text-white relative overflow-hidden"
              style={{ backgroundColor: "var(--navy)" }}
            >
              <div
                className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "radial-gradient(circle at 80% 50%, hsl(5 80% 54%) 0%, transparent 60%)" }}
              />
              <div className="relative z-10">
                <p className="text-white/60 text-sm mb-1">Welcome back,</p>
                <h1 className="text-2xl xl:text-3xl font-black mb-2">
                  {user.name?.split(" ")[0] ?? "Friend"} 👋
                </h1>
                <p className="text-white/60 text-sm max-w-md">
                  {user.isMember
                    ? "You're a valued member. Enjoy your exclusive discounts on every order."
                    : "Upgrade to membership and save up to 30% on every order."}
                </p>
                {!user.isMember && (
                  <Link
                    href="/account/membership"
                    className="inline-flex items-center gap-2 mt-4 bg-primary hover:bg-primary/90 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    <Crown className="h-4 w-4" /> Become a Member
                  </Link>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Orders",    value: "0",                         Icon: Package,  color: "text-blue-600",    bg: "bg-blue-50"    },
                { label: "Wishlist Items",  value: "0",                         Icon: Heart,    color: "text-rose-500",    bg: "bg-rose-50"    },
                { label: "Saved Addresses", value: "0",                         Icon: MapPin,   color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Membership",      value: user.isMember ? "Active" : "—", Icon: Crown, color: "text-amber-600",  bg: "bg-amber-50"   },
              ].map(({ label, value, Icon, color, bg }) => (
                <div key={label} className="bg-white rounded-2xl p-5 border border-border shadow-sm">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <p className="text-2xl font-black text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div>
              <h2 className="text-base font-bold text-foreground mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {QUICK_ACTIONS.map(({ Icon, title, desc, href, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group bg-white rounded-2xl p-5 border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 flex items-start gap-4"
                  >
                    <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-auto mt-0.5" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Membership upgrade card — non-members only */}
            {!user.isMember && (
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-foreground">Unlock Member Perks</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Join thousands of Australians saving on premium furniture</p>
                  </div>
                  <Crown className="h-6 w-6 text-amber-500 shrink-0" />
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PERKS.map(({ Icon, text }) => (
                    <div key={text} className="flex items-center gap-3 text-sm text-foreground">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      {text}
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-6">
                  <Link
                    href="/account/membership"
                    className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3 rounded-xl transition-colors"
                  >
                    <Crown className="h-4 w-4" /> View Membership Plans
                  </Link>
                </div>
              </div>
            )}

            {/* Recent orders */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-foreground">Recent Orders</h2>
                <Link href="/account/orders" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="px-6 py-14 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                  <Package className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground mb-1">No orders yet</p>
                <p className="text-sm text-muted-foreground mb-5">Your orders will appear here once you make a purchase.</p>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                >
                  <ShoppingBag className="h-4 w-4" /> Start Shopping
                </Link>
              </div>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
