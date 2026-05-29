"use client";

import { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, Clock, ChevronLeft, ChevronDown, ChevronUp,
  Save, FlaskConical, StickyNote,
} from "lucide-react";
import { TEST_CASES, getCategoriesForSuite, type Suite, type TestStatus } from "@/lib/qa-test-data";

interface SavedResult {
  testId: string;
  status: TestStatus;
  notes: string;
  comments: string;
}

interface Props {
  suite: Suite;
  initialResults: SavedResult[];
}

const STATUS_CONFIG: Record<TestStatus, { label: string; Icon: React.ComponentType<{ className?: string }>; bg: string; text: string; border: string; activeBg: string }> = {
  PASSED:  { label: "Pass",    Icon: CheckCircle2, bg: "bg-green-50",  text: "text-green-700",  border: "border-green-300",  activeBg: "bg-green-500"  },
  FAILED:  { label: "Fail",    Icon: XCircle,      bg: "bg-red-50",    text: "text-red-700",    border: "border-red-300",    activeBg: "bg-red-500"    },
  PENDING: { label: "Pending", Icon: Clock,        bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-300",  activeBg: "bg-amber-400"  },
};

const SUITE_LABELS: Record<Suite, string> = {
  login: "Login Page",
  signup: "Signup Page",
  profile: "Profile Page",
  products: "Products & Catalog",
  cart: "Shopping Cart",
  wishlist: "Wishlist",
  checkout: "Checkout",
  orders: "Orders",
  membership: "Membership",
  "admin-products": "Admin - Products",
  "admin-orders": "Admin - Orders",
  "admin-customers": "Admin - Customers",
  "admin-coupons": "Admin - Coupons",
  blog: "Blog",
};

export default function SuiteRunner({ suite, initialResults }: Props) {
  const cases = TEST_CASES.filter((t) => t.suite === suite);
  const categories = getCategoriesForSuite(suite);

  const [results, setResults] = useState<Record<string, SavedResult>>(() => {
    const map: Record<string, SavedResult> = {};
    cases.forEach((c) => {
      map[c.id] = { testId: c.id, status: "PENDING", notes: "", comments: "" };
    });
    initialResults.forEach((r) => {
      map[r.testId] = { ...map[r.testId], ...r, comments: r.comments ?? "" };
    });
    return map;
  });

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const updateStatus = useCallback(async (testId: string, status: TestStatus) => {
    const current = results[testId];
    const next = { ...current, status };
    setResults((prev) => ({ ...prev, [testId]: next }));
    setSaving((prev) => ({ ...prev, [testId]: true }));
    setSaved((prev) => ({ ...prev, [testId]: false }));

    try {
      await fetch("/api/qa/results", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, suite, status, notes: current.notes, comments: current.comments }),
      });
      setSaved((prev) => ({ ...prev, [testId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [testId]: false })), 1500);
    } finally {
      setSaving((prev) => ({ ...prev, [testId]: false }));
    }
  }, [results, suite]);

  const updateNotes = useCallback((testId: string, notes: string) => {
    setResults((prev) => ({ ...prev, [testId]: { ...prev[testId], notes } }));
  }, []);

  const updateComments = useCallback((testId: string, comments: string) => {
    setResults((prev) => ({ ...prev, [testId]: { ...prev[testId], comments } }));
  }, []);

  const saveNotes = useCallback(async (testId: string) => {
    const current = results[testId];
    setSaving((prev) => ({ ...prev, [testId]: true }));
    try {
      await fetch("/api/qa/results", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, suite, status: current.status, notes: current.notes, comments: current.comments }),
      });
      setSaved((prev) => ({ ...prev, [testId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [testId]: false })), 1500);
    } finally {
      setSaving((prev) => ({ ...prev, [testId]: false }));
    }
  }, [results, suite]);

  const saveComments = useCallback(async (testId: string) => {
    const current = results[testId];
    setSaving((prev) => ({ ...prev, [testId]: true }));
    try {
      await fetch("/api/qa/results", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, suite, status: current.status, notes: current.notes, comments: current.comments }),
      });
      setSaved((prev) => ({ ...prev, [testId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [testId]: false })), 1500);
    } finally {
      setSaving((prev) => ({ ...prev, [testId]: false }));
    }
  }, [results, suite]);

  const toggleNotes = useCallback((testId: string) => {
    setExpandedNotes((prev) => ({ ...prev, [testId]: !prev[testId] }));
  }, []);

  const toggleComments = useCallback((testId: string) => {
    setExpandedComments((prev) => ({ ...prev, [testId]: !prev[testId] }));
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const allResults = Object.values(results);
  const passed = allResults.filter((r) => r.status === "PASSED").length;
  const failed = allResults.filter((r) => r.status === "FAILED").length;
  const pending = allResults.filter((r) => r.status === "PENDING").length;
  const total = cases.length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 lg:py-10">

        {/* Back + Title */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/qa" className="hover:text-primary transition-colors flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> QA Dashboard
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{SUITE_LABELS[suite]}</span>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FlaskConical className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-black text-foreground">{SUITE_LABELS[suite]} — Test Suite</h1>
              </div>
              <p className="text-sm text-muted-foreground">{total} test cases · Click a status button to update</p>
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold">
              <span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="h-4 w-4" />{passed}</span>
              <span className="flex items-center gap-1.5 text-red-600"><XCircle className="h-4 w-4" />{failed}</span>
              <span className="flex items-center gap-1.5 text-amber-600"><Clock className="h-4 w-4" />{pending}</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{passed} of {total} passed</span>
              <span className="font-bold text-foreground">{pct}%</span>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: pct === 100 ? "#22c55e" : pct > 50 ? "#86efac" : "#fbbf24",
                }}
              />
            </div>
          </div>
        </div>

        {/* Test cases by category */}
        <div className="space-y-4">
          {categories.map((category) => {
            const catCases = cases.filter((c) => c.category === category);
            const catPassed = catCases.filter((c) => results[c.id]?.status === "PASSED").length;
            const catFailed = catCases.filter((c) => results[c.id]?.status === "FAILED").length;
            const isCollapsed = collapsedCats[category];

            return (
              <div key={category} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-5 py-4 border-b border-border hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="font-bold text-foreground text-sm">{category}</h2>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {catCases.length} cases
                    </span>
                    {catPassed > 0 && (
                      <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        {catPassed} passed
                      </span>
                    )}
                    {catFailed > 0 && (
                      <span className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        {catFailed} failed
                      </span>
                    )}
                  </div>
                  {isCollapsed
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  }
                </button>

                {/* Test rows */}
                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {catCases.map((tc) => {
                      const res = results[tc.id] ?? { testId: tc.id, status: "PENDING" as TestStatus, notes: "" };
                      const currentStatus = res.status;
                      const isSaving = saving[tc.id];
                      const isSaved = saved[tc.id];
                      const notesOpen = expandedNotes[tc.id];

                      return (
                        <div key={tc.id} className="px-5 py-4">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3">

                            {/* ID badge */}
                            <span className="text-[11px] font-black text-muted-foreground bg-secondary px-2 py-1 rounded-lg w-fit shrink-0 font-mono">
                              {tc.id}
                            </span>

                            {/* Description + steps/expected */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground mb-1">{tc.description}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                <span className="font-medium text-foreground/70">Steps:</span> {tc.steps}
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                                <span className="font-medium text-foreground/70">Expected:</span> {tc.expected}
                              </p>
                            </div>

                            {/* Status buttons + notes toggle */}
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              {(["PASSED", "FAILED", "PENDING"] as TestStatus[]).map((s) => {
                                const cfg = STATUS_CONFIG[s];
                                const isActive = currentStatus === s;
                                return (
                                  <button
                                    key={s}
                                    onClick={() => updateStatus(tc.id, s)}
                                    disabled={isSaving}
                                    title={cfg.label}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-150 disabled:opacity-50
                                      ${isActive
                                        ? `${cfg.activeBg} text-white border-transparent shadow-sm`
                                        : `${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80`
                                      }`}
                                  >
                                    <cfg.Icon className="h-3 w-3" />
                                    {cfg.label}
                                  </button>
                                );
                              })}

                              <button
                                onClick={() => toggleNotes(tc.id)}
                                title="Add notes"
                                className={`p-1.5 rounded-lg border transition-colors ${notesOpen || res.notes ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary text-muted-foreground border-border hover:text-foreground"}`}
                              >
                                <StickyNote className="h-3.5 w-3.5" />
                              </button>

                              <button
                                onClick={() => toggleComments(tc.id)}
                                title="Add issue comments"
                                className={`p-1.5 rounded-lg border transition-colors ${expandedComments[tc.id] || res.comments ? "bg-red-50 text-red-600 border-red-200" : "bg-secondary text-muted-foreground border-border hover:text-foreground"}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              </button>

                              {isSaved && (
                                <span className="text-[10px] text-green-600 font-bold">Saved ✓</span>
                              )}
                            </div>
                          </div>

                          {/* Notes panel */}
                          {notesOpen && (
                            <div className="mt-3 flex gap-2">
                              <textarea
                                value={res.notes ?? ""}
                                onChange={(e) => updateNotes(tc.id, e.target.value)}
                                placeholder="Add notes, bug details, or observations…"
                                rows={2}
                                className="flex-1 text-xs border border-border rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-secondary/40 placeholder:text-muted-foreground"
                              />
                              <button
                                onClick={() => saveNotes(tc.id)}
                                disabled={isSaving}
                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 self-start mt-0.5"
                              >
                                <Save className="h-3 w-3" />
                                Save
                              </button>
                            </div>
                          )}

                          {/* Comments panel - for issue/bug reports */}
                          {expandedComments[tc.id] && (
                            <div className="mt-3 flex gap-2">
                              <textarea
                                value={res.comments ?? ""}
                                onChange={(e) => updateComments(tc.id, e.target.value)}
                                placeholder="Describe the issue, bug, or problem found during testing…"
                                rows={3}
                                className="flex-1 text-xs border border-red-200 rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-red-50/50 placeholder:text-muted-foreground"
                              />
                              <button
                                onClick={() => saveComments(tc.id)}
                                disabled={isSaving}
                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 self-start mt-0.5"
                              >
                                <Save className="h-3 w-3" />
                                Save
                              </button>
                            </div>
                          )}

                          {/* Show existing comments if any */}
                          {!expandedComments[tc.id] && res.comments && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                              <p className="text-xs text-red-700">
                                <span className="font-bold">Issue:</span> {res.comments}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Link href="/qa" className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:underline">
            <ChevronLeft className="h-4 w-4" /> Back to QA Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
