"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  ShoppingCart,
  RotateCcw,
  Package,
  UserPlus,
  ShoppingBag,
  AlertTriangle,
  RefreshCw,
  X,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationType = "pending_order" | "refund_request" | "low_stock" | "new_customer" | "new_order";
type Priority = "high" | "medium" | "low";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  href: string;
  createdAt: string;
  priority: Priority;
}

interface NotificationData {
  notifications: Notification[];
  counts: {
    total: number;
    high: number;
    refundRequests: number;
    pendingOrders: number;
    lowStock: number;
  };
}

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; iconClass: string; dotClass: string }> = {
  refund_request: { icon: RotateCcw,   iconClass: "bg-red-100 text-red-600",    dotClass: "bg-red-500" },
  new_order:      { icon: ShoppingBag, iconClass: "bg-blue-100 text-blue-600",  dotClass: "bg-blue-500" },
  pending_order:  { icon: ShoppingCart,iconClass: "bg-amber-100 text-amber-600",dotClass: "bg-amber-500" },
  low_stock:      { icon: Package,     iconClass: "bg-orange-100 text-orange-600", dotClass: "bg-orange-500" },
  new_customer:   { icon: UserPlus,    iconClass: "bg-emerald-100 text-emerald-600", dotClass: "bg-emerald-500" },
};

const PRIORITY_BADGE: Record<Priority, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low:    "bg-slate-100 text-slate-600 border-slate-200",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AdminNotificationPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<NotificationType | "all">("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Auto-refresh every 60 seconds when panel is open
  useEffect(() => {
    if (!open) return;
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [open, fetchNotifications]);

  // Fetch badge count on mount (without opening panel)
  useEffect(() => {
    fetch("/api/admin/notifications")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setData(d))
      .catch(() => null);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const visibleNotifications = (data?.notifications ?? []).filter(
    (n) => !dismissed.has(n.id) && (activeFilter === "all" || n.type === activeFilter)
  );

  const undismissedCount = (data?.notifications ?? []).filter((n) => !dismissed.has(n.id)).length;
  const highCount = (data?.notifications ?? []).filter((n) => !dismissed.has(n.id) && n.priority === "high").length;

  const filterTabs: { key: NotificationType | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "refund_request", label: "Refunds" },
    { key: "new_order", label: "Orders" },
    { key: "pending_order", label: "Pending" },
    { key: "low_stock", label: "Stock" },
    { key: "new_customer", label: "Customers" },
  ];

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer",
          open && "bg-muted text-foreground"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {undismissedCount > 0 && (
          <span className={cn(
            "absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white",
            highCount > 0 ? "bg-red-500" : "bg-primary"
          )}>
            {undismissedCount > 9 ? "9+" : undismissedCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-10 z-50 w-[380px] max-h-[560px] flex flex-col rounded-xl border border-border bg-background shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-foreground" />
              <span className="text-sm font-bold text-foreground">Notifications</span>
              {undismissedCount > 0 && (
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {undismissedCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchNotifications}
                disabled={loading}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </button>
              {undismissedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setDismissed(new Set((data?.notifications ?? []).map((n) => n.id)))}
                  className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Summary chips */}
          {data && data.counts.total > 0 && (
            <div className="flex items-center gap-1.5 px-4 py-2 bg-muted/30 border-b border-border shrink-0 overflow-x-auto">
              {data.counts.refundRequests > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                  <RotateCcw className="h-2.5 w-2.5" />
                  {data.counts.refundRequests} refund{data.counts.refundRequests > 1 ? "s" : ""}
                </span>
              )}
              {data.counts.pendingOrders > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                  <ShoppingCart className="h-2.5 w-2.5" />
                  {data.counts.pendingOrders} pending
                </span>
              )}
              {data.counts.lowStock > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {data.counts.lowStock} low stock
                </span>
              )}
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-0.5 px-3 py-2 border-b border-border shrink-0 overflow-x-auto">
            {filterTabs.map((tab) => {
              const count = tab.key === "all"
                ? undismissedCount
                : (data?.notifications ?? []).filter((n) => !dismissed.has(n.id) && n.type === tab.key).length;
              if (tab.key !== "all" && count === 0) return null;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                    activeFilter === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={cn(
                      "ml-1 text-[9px] font-bold",
                      activeFilter === tab.key ? "opacity-80" : "opacity-60"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {loading && !data ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Inbox className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">All caught up</p>
                <p className="text-xs text-muted-foreground">No notifications to show</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleNotifications.map((n) => {
                  const cfg = TYPE_CONFIG[n.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={n.id} className="group relative flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                      {/* Icon */}
                      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", cfg.iconClass)}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground leading-snug">{n.title}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                          {n.description}
                        </p>
                        <span className={cn(
                          "mt-1.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                          PRIORITY_BADGE[n.priority]
                        )}>
                          {n.priority}
                        </span>
                      </Link>

                      {/* Dismiss */}
                      <button
                        type="button"
                        onClick={() => setDismissed((prev) => new Set([...prev, n.id]))}
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all cursor-pointer"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5 shrink-0">
            <Link
              href="/admin/orders?status=PENDING"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              View all pending orders
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
