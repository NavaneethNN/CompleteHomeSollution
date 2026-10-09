import { Crown } from "lucide-react";

export function OrderMembershipItem({ amount, durationDays }: { amount: number; durationDays: number | null }) {
  if (!(amount > 0)) return null;
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Crown className="h-6 w-6 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Membership</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {durationDays ? `${durationDays} days · ` : ""}Digital membership · No delivery required
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold">${amount.toFixed(2)}</p>
    </div>
  );
}
