"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  Search, X, Crown, ShieldCheck, User2, ShoppingBag,
  Mail, DollarSign, BadgeCheck, Circle,
  ChevronRight, Loader2, ArrowUpRight,
} from "lucide-react";
import {
  setCustomerRole,
  setCustomerMembership,
} from "@/lib/actions/admin-customers";
import type { AdminCustomer, AdminCustomerDetail } from "@/lib/actions/admin-customers";
import Link from "next/link";

const currencyFmt = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
});

const ORDER_STATUS_COLOURS: Record<string, string> = {
  PENDING:    "bg-amber-100 text-amber-700",
  PAID:       "bg-blue-100 text-blue-700",
  PROCESSING: "bg-indigo-100 text-indigo-700",
  SHIPPED:    "bg-violet-100 text-violet-700",
  DELIVERED:  "bg-emerald-100 text-emerald-700",
  CANCELLED:  "bg-red-100 text-red-700",
  REFUNDED:   "bg-orange-100 text-orange-700",
};

function Avatar({ name, image, size = "md" }: { name: string | null; image: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "h-14 w-14 text-xl" : size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  const initials = name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?";
  return image ? (
    <img src={image} alt={name ?? ""} referrerPolicy="no-referrer" className={`${sz} rounded-full object-cover shrink-0 ring-2 ring-border`} />
  ) : (
    <div className={`${sz} rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return role === "ADMIN" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-bold">
      <ShieldCheck className="h-3 w-3" /> Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs font-medium">
      <User2 className="h-3 w-3" /> Customer
    </span>
  );
}

function MemberBadge({ isMember }: { isMember: boolean }) {
  return isMember ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-bold">
      <Crown className="h-3 w-3" /> Member
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs font-medium">
      <Circle className="h-3 w-3" /> Standard
    </span>
  );
}

/* ── Customer Detail Drawer ──────────────────────────────────────────── */

function CustomerDrawer({
  customerId,
  onClose,
  onUpdated,
}: {
  customerId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Fetch detail on mount via API route
  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/customers/${customerId}`)
      .then((r) => r.json())
      .then((d) => {
        setDetail(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [customerId]);

  const handleRoleToggle = () => {
    if (!detail) return;
    const newRole = detail.role === "ADMIN" ? "CUSTOMER" : "ADMIN";
    startTransition(async () => {
      await setCustomerRole(detail.id, newRole);
      setDetail((prev) => prev ? { ...prev, role: newRole } : prev);
      onUpdated();
    });
  };

  const handleMemberToggle = () => {
    if (!detail) return;
    const newMember = !detail.isMember;
    startTransition(async () => {
      await setCustomerMembership(detail.id, newMember);
      setDetail((prev) =>
        prev ? { ...prev, isMember: newMember, memberSince: newMember ? new Date() : null } : prev
      );
      onUpdated();
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[460px] flex-col bg-card shadow-2xl border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-bold text-foreground">Customer Detail</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !detail ? (
            <p className="p-6 text-sm text-muted-foreground">Customer not found.</p>
          ) : (
            <div className="p-6 space-y-6">
              {/* Profile card */}
              <div className="flex items-start gap-4">
                <Avatar name={detail.name} image={detail.image} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-foreground truncate">{detail.name ?? "—"}</p>
                  <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {detail.email ?? "—"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <RoleBadge role={detail.role} />
                    <MemberBadge isMember={detail.isMember} />
                    {detail.emailVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-medium">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Orders", value: detail._count.orders, icon: ShoppingBag, color: "text-blue-600" },
                  { label: "Total Spend",  value: currencyFmt.format(detail.totalSpend), icon: DollarSign, color: "text-emerald-600" },
                  { label: "Member Since", value: detail.memberSince ? new Date(detail.memberSince).toLocaleDateString("en-AU", { month: "short", year: "numeric" }) : "—", icon: Crown, color: "text-amber-600" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                    <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
                    <p className="text-sm font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Info rows */}
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {[
                  { label: "User ID",       value: detail.id.slice(-12).toUpperCase() },
                  { label: "Joined",        value: new Date(detail.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) },
                  { label: "Email verified", value: detail.emailVerified ? new Date(detail.emailVerified).toLocaleDateString("en-AU") : "Not verified" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3 bg-card text-sm">
                    <span className="text-muted-foreground font-medium">{label}</span>
                    <span className="text-foreground font-semibold text-right">{value}</span>
                  </div>
                ))}
              </div>

              {/* Admin controls */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <p className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/40">
                  Admin Controls
                </p>

                {/* Membership toggle */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Premium Membership</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {detail.isMember ? "Member — click to revoke" : "Not a member — click to grant"}
                    </p>
                  </div>
                  <button
                    onClick={handleMemberToggle}
                    disabled={isPending}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      detail.isMember ? "bg-amber-500" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        detail.isMember ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Role toggle */}
                <div className="flex items-center justify-between px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Admin Role</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {detail.role === "ADMIN" ? "Has admin access — click to demote" : "Standard user — click to promote"}
                    </p>
                  </div>
                  <button
                    onClick={handleRoleToggle}
                    disabled={isPending}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      detail.role === "ADMIN" ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        detail.role === "ADMIN" ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Recent orders */}
              {detail.recentOrders.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Orders</p>
                    <Link
                      href={`/admin/orders?customer=${detail.id}`}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
                    >
                      View all <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="divide-y divide-border">
                    {detail.recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-semibold text-foreground">
                            #{order.id.slice(-8).toUpperCase()}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(order.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ORDER_STATUS_COLOURS[order.status] ?? "bg-muted text-muted-foreground"}`}>
                          {order.status}
                        </span>
                        <span className="text-sm font-bold text-foreground shrink-0">
                          {currencyFmt.format(order.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-border bg-muted/40 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}

/* ── Main Customers Table ─────────────────────────────────────────────── */

export function CustomersClient({ initialCustomers }: { initialCustomers: AdminCustomer[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "member" | "admin">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<AdminCustomer[]>(initialCustomers);

  const filtered = useMemo(() => {
    let list = customers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      );
    }
    if (filter === "member") list = list.filter((c) => c.isMember);
    if (filter === "admin")  list = list.filter((c) => c.role === "ADMIN");
    return list;
  }, [customers, search, filter]);

  // After a role/member change re-fetch that row and patch local state
  const handleUpdated = () => {
    if (!selectedId) return;
    fetch(`/api/admin/customers/${selectedId}`)
      .then((r) => r.json())
      .then((updated: AdminCustomerDetail) => {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === selectedId
              ? { ...c, role: updated.role, isMember: updated.isMember, memberSince: updated.memberSince }
              : c
          )
        );
      })
      .catch(() => {});
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-lg border border-border bg-card overflow-hidden shrink-0">
          {(["all", "member", "admin"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? `All (${customers.length})` : f === "member" ? `Members (${customers.filter(c => c.isMember).length})` : `Admins (${customers.filter(c => c.role === "ADMIN").length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Membership</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Orders</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Spend</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(customer.id)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.name} image={customer.image} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{customer.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{customer.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <RoleBadge role={customer.role} />
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <MemberBadge isMember={customer.isMember} />
                  </td>
                  <td className="px-5 py-3.5 text-sm text-foreground font-medium hidden sm:table-cell">
                    {customer._count.orders}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-foreground hidden sm:table-cell">
                    {currencyFmt.format(customer.totalSpend)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
                    {new Date(customer.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {selectedId && (
        <CustomerDrawer
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
