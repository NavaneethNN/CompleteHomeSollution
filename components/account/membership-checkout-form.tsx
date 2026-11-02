"use client";

import { useRef, useState } from "react";
import { ShieldCheck, Lock, CheckCircle2, Loader2 } from "lucide-react";

export function MembershipCheckoutForm({ planId }: { planId: string }) {
  const [busy, setBusy] = useState(false);
  const [orderUrl, setOrderUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setBusy(true);
        setError("");
        setOrderUrl(null);
        const address = Object.fromEntries(new FormData(event.currentTarget));
        try {
          const response = await fetch("/api/membership/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId, address }),
          });
          const data = await response.json();
          if (
            typeof data.orderUrl === "string" &&
            /^\/order-confirmation\/c[a-z0-9]+$/.test(data.orderUrl)
          ) {
            setOrderUrl(data.orderUrl);
          }
          if (!response.ok || !data.url) {
            throw new Error(data.error || "Unable to open payment checkout.");
          }
          window.location.assign(data.url);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to open payment checkout.");
          submitting.current = false;
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs font-semibold text-foreground">
          Full Name
          <input
            name="name"
            autoComplete="name"
            type="text"
            required
            disabled={busy}
            maxLength={100}
            placeholder="e.g. Jane Doe"
            className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="block text-xs font-semibold text-foreground">
          Phone Number
          <input
            name="phone"
            autoComplete="tel"
            type="tel"
            required
            disabled={busy}
            maxLength={30}
            placeholder="e.g. 0412 345 678"
            className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      <label className="block text-xs font-semibold text-foreground">
        Billing Address
        <input
          name="line1"
          autoComplete="address-line1"
          type="text"
          required
          disabled={busy}
          maxLength={120}
          placeholder="e.g. 123 King William St"
          className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <label className="block text-xs font-semibold text-foreground sm:col-span-1">
          Suburb / City
          <input
            name="suburb"
            autoComplete="address-level2"
            type="text"
            required
            disabled={busy}
            maxLength={100}
            placeholder="e.g. Adelaide"
            className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block text-xs font-semibold text-foreground sm:col-span-1">
          State
          <select
            name="state"
            autoComplete="address-level1"
            required
            disabled={busy}
            className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          >
            {["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-foreground sm:col-span-1">
          Postcode
          <input
            name="postcode"
            autoComplete="postal-code"
            type="text"
            pattern="[0-9]{4}"
            required
            disabled={busy}
            maxLength={4}
            placeholder="5000"
            className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      {/* Autopay Enabled by Default Disclosure */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950 flex items-start gap-2.5 shadow-2xs">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-emerald-900">Autopay Enabled by Default</span>
            <span className="text-[10px] bg-emerald-200/90 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
              Annual Auto-Renewal
            </span>
          </div>
          <p className="text-emerald-800 text-[11px] leading-relaxed">
            Your VIP membership will automatically renew every year so your 5% discount and warranty privileges never lapse. You can easily manage or cancel anytime in 1 click from your account dashboard with zero cancellation fees.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 font-medium">
          {error}
        </p>
      )}

      {orderUrl && (
        <a href={orderUrl} className="block text-xs font-semibold text-primary underline">
          Check payment status
        </a>
      )}

      <button
        type="submit"
        disabled={busy || !!orderUrl}
        className="w-full rounded-xl bg-primary py-3.5 px-4 font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90 transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>Opening secure payment…</span>
          </>
        ) : (
          <span>Continue to Secure Payment</span>
        )}
      </button>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-1">
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3 text-muted-foreground" /> SSL Secured
        </span>
        <span>•</span>
        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Autopay Active
        </span>
        <span>•</span>
        <span>Cancel Anytime</span>
      </div>
    </form>
  );
}
