import type { Metadata } from "next";
import { getPlans, getMembers } from "@/lib/actions/admin-membership";
import { MembershipClient } from "@/components/admin/membership-client";
import { Crown, Users, DollarSign } from "lucide-react";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Membership — Admin" };

export default async function AdminMembershipPage() {
  const [plans, members] = await Promise.all([getPlans(), getMembers()]);

  const activePlans = plans.filter((p) => p.isActive).length;
  // Revenue comes from actual MembershipPayment records, not a member count × plan price estimate
  const revenueResult = await db.membershipPayment.aggregate({ _sum: { amount: true } });
  const totalRevenue = revenueResult._sum.amount ?? 0;

  const statCards = [
    { label: "Plans",          value: plans.length,   sub: `${activePlans} active`,             icon: Crown,       accent: "bg-amber-500" },
    { label: "Active Members", value: members.length, sub: "Premium subscribers",               icon: Users,       accent: "bg-primary" },
    { label: "Est. Revenue",   value: `$${totalRevenue.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, sub: "Total membership revenue", icon: DollarSign,  accent: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-foreground">Membership</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage plans and active subscribers</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map(({ label, value, sub, icon: Icon, accent }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm flex items-center gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-2xl font-black text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <MembershipClient initialPlans={plans} initialMembers={members} />
    </div>
  );
}
