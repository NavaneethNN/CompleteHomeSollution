"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { AdminNotificationPanel } from "@/components/admin/notification-panel";

const ROUTE_LABELS: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/analytics": "Analytics",
  "/admin/products": "Products",
  "/admin/products/new": "New Product",
  "/admin/orders": "Orders",
  "/admin/customers": "Customers",
  "/admin/membership": "Membership",
  "/admin/blog": "Blog",
  "/admin/blog/new": "New Post",
  "/admin/settings": "Settings",
};

function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let path = "";
  for (const seg of segments) {
    path += `/${seg}`;
    const label = ROUTE_LABELS[path] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, href: path });
  }
  return crumbs;
}

export function AdminHeader() {
  const { data: session } = useSession();
  const crumbs = useBreadcrumbs();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background pl-16 pr-6 lg:px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            {i === crumbs.length - 1 ? (
              <span className="font-semibold text-foreground">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <AdminNotificationPanel />

        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold uppercase text-primary-foreground">
            {session?.user?.name?.[0] ?? "A"}
          </div>
          <span className="text-xs font-medium text-foreground hidden sm:block">
            {session?.user?.name ?? "Admin"}
          </span>
        </div>
      </div>
    </header>
  );
}
