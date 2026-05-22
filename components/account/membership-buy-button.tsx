"use client";

import { useState } from "react";
import { Crown, Loader2 } from "lucide-react";

interface MembershipBuyButtonProps {
  readonly planId?: string;
  readonly label?: string;
  readonly variant?: "primary" | "outline";
  readonly className?: string;
}

export function MembershipBuyButton({ planId, label, variant = "primary", className }: MembershipBuyButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: planId ? JSON.stringify({ planId }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const base = "w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold text-sm px-6 py-3 transition-all disabled:opacity-60 disabled:cursor-not-allowed";
  const styles = variant === "outline"
    ? `${base} border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground`
    : `${base} bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm`;

  return (
    <div className="flex flex-col gap-1.5">
      <button onClick={handlePurchase} disabled={isLoading} className={`${styles} ${className ?? ""}`}>
        {isLoading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
        ) : (
          <><Crown className="h-4 w-4" /> {label ?? "Get Membership"}</>
        )}
      </button>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
    </div>
  );
}
