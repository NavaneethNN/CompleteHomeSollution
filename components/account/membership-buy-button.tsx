"use client";

import Link from "next/link";
import { Crown } from "lucide-react";

interface MembershipBuyButtonProps {
  readonly planId?: string;
  readonly label?: string;
  readonly variant?: "primary" | "outline";
  readonly className?: string;
}

export function MembershipBuyButton({ planId, label, variant = "primary", className }: MembershipBuyButtonProps) {
  const base = "w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold text-sm px-6 py-3 transition-all disabled:opacity-60 disabled:cursor-not-allowed";
  const styles = variant === "outline"
    ? `${base} border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground`
    : `${base} bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm`;

  return <Link href={`/membership/checkout${planId ? `?planId=${encodeURIComponent(planId)}` : ""}`} className={`${styles} ${className ?? ""}`}>
    <Crown className="h-4 w-4" /> {label ?? "Get Membership"}
  </Link>;
}
