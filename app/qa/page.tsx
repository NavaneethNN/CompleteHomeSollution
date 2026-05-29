import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { TEST_CASES, SUITE_META, type Suite } from "@/lib/qa-test-data";
import { CheckCircle2, XCircle, ArrowRight, FlaskConical } from "lucide-react";

export const metadata: Metadata = { title: "QA Test Dashboard — CHS" };
export const dynamic = "force-dynamic"; // Always fetch fresh stats from database

async function getSuiteStats(suite: Suite) {
  try {
    const results = await db.testResult.findMany({ where: { suite } });
    const total = TEST_CASES.filter((t) => t.suite === suite).length;
    const passed = results.filter((r) => r.status === "PASSED").length;
    const failed = results.filter((r) => r.status === "FAILED").length;
    const pending = total - passed - failed;
    return { total, passed, failed, pending };
  } catch {
    // Return default stats if DB table doesn't exist
    const total = TEST_CASES.filter((t) => t.suite === suite).length;
    return { total, passed: 0, failed: 0, pending: total };
  }
}

const ALL_SUITES: Suite[] = [
  "login",
  "signup",
  "profile",
  "products",
  "cart",
  "wishlist",
  "checkout",
  "orders",
  "membership",
  "admin-products",
  "admin-orders",
  "admin-customers",
  "admin-coupons",
  "blog",
];

export default async function QADashboardPage() {
  const allStats = await Promise.all(ALL_SUITES.map((suite) => getSuiteStats(suite)));
  
  const statsMap = Object.fromEntries(ALL_SUITES.map((suite, i) => [suite, allStats[i]])) as Record<Suite, { total: number; passed: number; failed: number; pending: number }>;

  const totalPassed = Object.values(statsMap).reduce((sum, s) => sum + s.passed, 0);
  const totalFailed = Object.values(statsMap).reduce((sum, s) => sum + s.failed, 0);
  const totalPending = Object.values(statsMap).reduce((sum, s) => sum + s.pending, 0);
  const grandTotal = Object.values(statsMap).reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 lg:py-14">

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-4" suppressHydrationWarning>
            <FlaskConical className="h-3.5 w-3.5" />
            QA TEST DASHBOARD
          </div>
          <h1 className="text-3xl font-black text-foreground mb-2">
            Complete Home Sollution
          </h1>
          <p className="text-muted-foreground text-sm">
            Select a page below to view and update test case statuses. All results are saved to the database.
          </p>
        </div>

        {/* Overall summary */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Cases", value: grandTotal, Icon: FlaskConical, bg: "bg-secondary", color: "text-foreground" },
            { label: "Passed", value: totalPassed, Icon: CheckCircle2, bg: "bg-green-50", color: "text-green-600" },
            { label: "Failed", value: totalFailed, Icon: XCircle, bg: "bg-red-50", color: "text-red-600" },
            { label: "Pending", value: totalPending, Icon: FlaskConical, bg: "bg-amber-50", color: "text-amber-600" },
          ].map(({ label, value, Icon, bg, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-border p-5 shadow-sm text-center">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className="text-2xl font-black text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Suite cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {ALL_SUITES.map((suite) => {
            const meta = SUITE_META[suite];
            const stats = statsMap[suite];
            const pct = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;

            return (
              <Link
                key={suite}
                href={`/qa/${encodeURIComponent(suite)}`}
                className="group bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden"
              >
                {/* Card header */}
                <div className={`px-6 pt-6 pb-5 border-b border-border`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
                        {suite.toUpperCase()} SUITE
                      </p>
                      <h2 className="text-xl font-black text-foreground group-hover:text-primary transition-colors">
                        {meta.label}
                      </h2>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{stats.passed} / {stats.total} passed</span>
                      <span className="font-bold text-foreground">{pct}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 divide-x divide-border">
                  {[
                    { label: "Passed", value: stats.passed, color: "text-green-600", bg: "bg-green-50" },
                    { label: "Failed", value: stats.failed, color: "text-red-600", bg: "bg-red-50" },
                    { label: "Pending", value: stats.pending, color: "text-amber-600", bg: "bg-amber-50" },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className="px-4 py-4 text-center">
                      <p className={`text-xl font-black ${color}`}>{value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          {grandTotal} test cases across {ALL_SUITES.length} suites. Click any card to view and run tests.
        </p>
      </div>
    </div>
  );
}
