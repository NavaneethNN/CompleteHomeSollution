"use client";
import { useRef, useState } from "react";

export function MembershipCheckoutForm({ planId }: { planId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    const address = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/membership/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, address }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Unable to open payment checkout.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open payment checkout.");
      submitting.current = false; setBusy(false);
    }
  }}>
    {[
      ["name", "Full name", "name", "text"], ["phone", "Phone", "tel", "tel"],
      ["line1", "Billing address", "address-line1", "text"], ["suburb", "Suburb / city", "address-level2", "text"],
      ["postcode", "Postcode", "postal-code", "text"],
    ].map(([name, label, autoComplete, type]) => <label key={name} className="block text-sm font-medium">{label}
      <input name={name} autoComplete={autoComplete} type={type} required disabled={busy} maxLength={name === "postcode" ? 4 : name === "phone" ? 30 : name === "line1" ? 120 : 100}
        pattern={name === "postcode" ? "[0-9]{4}" : undefined} className="mt-1 w-full rounded-lg border p-3" />
    </label>)}
    <label className="block text-sm font-medium">State
      <select name="state" autoComplete="address-level1" required disabled={busy} className="mt-1 w-full rounded-lg border p-3">
        {["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map(state => <option key={state}>{state}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-primary p-3 font-bold text-primary-foreground disabled:opacity-60">{busy ? "Opening secure payment…" : "Continue to secure payment"}</button>
  </form>;
}
