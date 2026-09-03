"use client";

import { useState, useTransition } from "react";
import {
  Crown, Plus, Pencil, Trash2, Star, Check,
  Users, Calendar, Tag, Percent, X, Loader2,
  ToggleLeft, ToggleRight, AlertCircle,
} from "lucide-react";
import {
  createPlan, updatePlan, deletePlan, setDefaultPlan,
  revokeMembership, grantMembership,
} from "@/lib/actions/admin-membership";
import type { MembershipPlan, MemberUser, PlanInput } from "@/lib/actions/admin-membership";

const currencyFmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 });

/* ── Helpers ─────────────────────────────────────────────────────────── */

function durationLabel(days: number) {
  if (days % 365 === 0) return `${days / 365} year${days / 365 > 1 ? "s" : ""}`;
  if (days % 30 === 0)  return `${days / 30} month${days / 30 > 1 ? "s" : ""}`;
  return `${days} days`;
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  const initials = name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?";
  // eslint-disable-next-line @next/next/no-img-element
  return image ? (
    <img src={image} alt={name ?? ""} referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-border" />
  ) : (
    <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">{initials}</div>
  );
}

/* ── Plan Form Modal ─────────────────────────────────────────────────── */

const EMPTY_FORM: PlanInput = {
  name: "",
  description: "",
  price: 30,
  durationDays: 365,
  discountPercent: 0,
  isActive: true,
  isDefault: false,
};

function PlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: MembershipPlan | null;
  onClose: () => void;
  onSaved: (p: MembershipPlan) => void;
}) {
  const isEdit = !!plan;
  const [form, setForm] = useState<PlanInput>(
    plan
      ? {
          name: plan.name,
          description: plan.description ?? "",
          price: plan.price,
          durationDays: plan.durationDays,
          discountPercent: plan.discountPercent,
          isActive: plan.isActive,
          isDefault: plan.isDefault,
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = isEdit
        ? await updatePlan(plan!.id, form)
        : await createPlan(form);
      if (result.error) { setError(result.error); return; }
      onSaved({
        ...(plan ?? { id: "", createdAt: new Date(), updatedAt: new Date() }),
        ...form,
        updatedAt: new Date(),
      } as MembershipPlan);
      onClose();
    });
  };

  const DURATION_PRESETS = [
    { label: "Monthly",   days: 30 },
    { label: "Quarterly", days: 90 },
    { label: "Annual",    days: 365 },
    { label: "Lifetime",  days: 36500 },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <Crown className="h-4 w-4 text-amber-600" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                {isEdit ? "Edit Plan" : "New Membership Plan"}
              </h2>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Plan Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Annual Premium"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description</label>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                placeholder="Brief description shown to customers"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>

            {/* Price + Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Price (AUD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    required
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={form.price}
                    onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Member Discount (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form.discountPercent}
                    onChange={(e) => set("discountPercent", parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-background px-3 pr-8 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Duration *</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => set("durationDays", p.days)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      form.durationDays === p.days
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  required
                  type="number"
                  min={1}
                  value={form.durationDays}
                  onChange={(e) => set("durationDays", parseInt(e.target.value) || 1)}
                  className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span className="text-sm text-muted-foreground">days</span>
                <span className="text-xs text-muted-foreground">= {durationLabel(form.durationDays)}</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-6">
              {([
                { key: "isActive" as const,  label: "Active",   desc: "Visible to customers" },
                { key: "isDefault" as const, label: "Default",  desc: "Used in checkout" },
              ] as const).map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set(key, !form[key])}
                  className="flex items-center gap-2.5 group"
                >
                  {form[key]
                    ? <ToggleRight className="h-6 w-6 text-primary" />
                    : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Plan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ── Confirm Delete Modal ─────────────────────────────────────────────── */

function ConfirmDelete({ planName, onConfirm, onCancel, isPending }: {
  planName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mx-auto">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-foreground">Delete Plan</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Delete <strong>{planName}</strong>? This cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */

export function MembershipClient({
  initialPlans,
  initialMembers,
}: {
  initialPlans: MembershipPlan[];
  initialMembers: MemberUser[];
}) {
  const [plans, setPlans]       = useState<MembershipPlan[]>(initialPlans);
  const [members, setMembers]   = useState<MemberUser[]>(initialMembers);
  const [modalPlan, setModalPlan] = useState<MembershipPlan | "new" | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<MembershipPlan | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"plans" | "members">("plans");

  /* Plan handlers */
  const handlePlanSaved = (saved: MembershipPlan) => {
    setPlans((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
    });
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      await setDefaultPlan(id);
      setPlans((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
    });
  };

  const handleDeleteConfirm = () => {
    if (!deletingPlan) return;
    const id = deletingPlan.id;
    startTransition(async () => {
      await deletePlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
      setDeletingPlan(null);
    });
  };

  /* Member handlers */
  const handleRevoke = (userId: string) => {
    startTransition(async () => {
      await revokeMembership(userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    });
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {(["plans", "members"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "plans" ? `Plans (${plans.length})` : `Active Members (${members.length})`}
          </button>
        ))}
      </div>

      {/* ── Plans tab ──────────────────────────────────────────────── */}
      {tab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Manage membership plans available to customers.</p>
            <button
              onClick={() => setModalPlan("new")}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> New Plan
            </button>
          </div>

          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Crown className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-muted-foreground">No plans yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create a plan to start selling memberships.</p>
              <button
                onClick={() => setModalPlan("new")}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" /> Create First Plan
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-4 ${
                    plan.isDefault ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                  }`}
                >
                  {/* Default badge */}
                  {plan.isDefault && (
                    <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      <Star className="h-2.5 w-2.5" /> DEFAULT
                    </span>
                  )}

                  {/* Status dot */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">{plan.name}</h3>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          plan.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}>
                          {plan.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: Tag,     label: "Price",    value: currencyFmt.format(plan.price) },
                      { icon: Calendar,label: "Duration", value: durationLabel(plan.durationDays) },
                      { icon: Percent, label: "Discount", value: `${plan.discountPercent}%` },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-lg bg-muted/40 p-2.5 text-center">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                        <p className="text-xs font-bold text-foreground">{value}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-border">
                    {!plan.isDefault && (
                      <button
                        onClick={() => handleSetDefault(plan.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Set Default
                      </button>
                    )}
                    <div className="flex gap-1.5 ml-auto">
                      <button
                        onClick={() => setModalPlan(plan)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                        title="Edit plan"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeletingPlan(plan)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors"
                        title="Delete plan"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Members tab ────────────────────────────────────────────── */}
      {tab === "members" && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Member Since</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Expires</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Orders</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} image={m.image} />
                        <div>
                          <p className="font-semibold text-foreground">{m.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{m.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground hidden sm:table-cell">
                      {m.memberSince
                        ? new Date(m.memberSince).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground hidden lg:table-cell">
                      {m.membershipExpiry
                        ? (() => {
                            const isExpiringSoon = new Date(m.membershipExpiry).getTime() - Date.now() < 7 * 86400000;
                            return (
                              <span className={isExpiringSoon ? "text-amber-600 font-semibold" : ""}>
                                {new Date(m.membershipExpiry).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            );
                          })()
                        : <span className="text-muted-foreground/50">No expiry</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-foreground hidden md:table-cell">
                      {m._count.orders}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleRevoke(m.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                      >
                        <X className="h-3 w-3" /> Revoke
                      </button>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      No active members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan modal */}
      {modalPlan !== null && (
        <PlanModal
          plan={modalPlan === "new" ? null : modalPlan}
          onClose={() => setModalPlan(null)}
          onSaved={handlePlanSaved}
        />
      )}

      {/* Delete confirm */}
      {deletingPlan && (
        <ConfirmDelete
          planName={deletingPlan.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingPlan(null)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
