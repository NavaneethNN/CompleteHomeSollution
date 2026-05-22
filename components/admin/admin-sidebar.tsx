"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Crown,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Store,
  Settings,
  Bell,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/membership", label: "Membership", icon: Crown },
    ],
  },
];

function NavItem({
  href,
  label,
  icon: Icon,
  exact = false,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-primary-foreground" : "text-slate-400 group-hover:text-white"
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = useSession();

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0",
        collapsed ? "w-[64px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-slate-800",
        collapsed && "justify-center px-0"
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Store className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white leading-tight truncate">CHS Admin</p>
            <p className="text-[10px] text-slate-500 leading-tight">Complete Home Sollution</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.href} {...item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: User + Sign Out */}
      <div className="border-t border-slate-800 px-3 py-3 space-y-1">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold uppercase">
              {session?.user?.name?.[0] ?? "A"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{session?.user?.name ?? "Admin"}</p>
              <p className="text-[10px] text-slate-500 truncate">{session?.user?.email ?? ""}</p>
            </div>
          </div>
        ) : null}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-red-400 transition-colors",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors shadow-md"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}
