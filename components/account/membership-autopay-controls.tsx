"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  RefreshCw,
  AlertTriangle,
  XCircle,
  CreditCard,
  Loader2,
  Calendar,
  Sparkles,
  Info,
} from "lucide-react";

type Props = {
  isMember: boolean;
  initialAutoRenew: boolean;
  membershipExpiry: string | null;
  membershipStatus: string | null;
  membershipCancelReason: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  isAdmin?: boolean;
};

export function MembershipAutopayControls({
  isMember,
  initialAutoRenew,
  membershipExpiry,
  membershipStatus,
  membershipCancelReason,
  retryCount,
  nextRetryAt,
  isAdmin = false,
}: Props) {
  const router = useRouter();
  const [autoRenew, setAutoRenew] = useState(initialAutoRenew);
  const [updatingAutoRenew, setUpdatingAutoRenew] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [simulating, setSimulating] = useState(false);

  async function handleToggleAutoRenew(checked: boolean) {
    setUpdatingAutoRenew(true);
    try {
      const res = await fetch("/api/membership/toggle-autopay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update autopay");

      setAutoRenew(data.autoRenew);
      toast.success(data.message || (checked ? "Autopay enabled" : "Autopay paused"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update autopay");
    } finally {
      setUpdatingAutoRenew(false);
    }
  }

  async function handleCancelMembership() {
    setCancelling(true);
    try {
      const res = await fetch("/api/membership/cancel", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel membership");

      toast.success("Membership and autopay cancelled immediately.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel membership");
    } finally {
      setCancelling(false);
    }
  }

  async function handleSimulate(action: "simulate_failure" | "simulate_success") {
    setSimulating(true);
    try {
      const res = await fetch("/api/membership/simulate-autopay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulation failed");

      if (action === "simulate_failure") {
        if (data.result?.revoked) {
          toast.error(`Simulation: Membership REVOKED! Reason: ${data.result.message}`);
        } else {
          toast.warning(`Simulation: ${data.result?.message}`);
        }
      } else {
        toast.success("Simulation: Membership renewed successfully!");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Simulation error");
    } finally {
      setSimulating(false);
    }
  }

  const isRetrying = membershipStatus === "PAYMENT_RETRYING";

  return (
    <div className="space-y-4">
      {/* ── Retrying Warning Banner ── */}
      {isRetrying && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-amber-950">
              Payment Issue: Renewal Attempt {retryCount} of 2 Failed
            </p>
            <p className="text-amber-800">
              An automatic renewal charge failed due to insufficient funds or card issues.
              {nextRetryAt && (
                <> Our system will re-attempt payment on <strong>{new Date(nextRetryAt).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long" })}</strong> (different day).</>
              )}
            </p>
            <p className="text-amber-700 text-[11px]">
              If 2 retry attempts fail, your membership will be revoked stating a payment method failure issue.
            </p>
          </div>
        </div>
      )}

      {/* ── Active Member Autopay Management Card ── */}
      {isMember && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-6">
          <div>
            <h3 className="font-bold text-foreground text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Autopay & Membership Settings
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage automatic renewal and membership subscription preferences.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Membership Autopay</span>
                <Badge variant="outline" className={autoRenew ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]" : "bg-slate-100 text-slate-600 text-[10px]"}>
                  {autoRenew ? "Enabled" : "Paused"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {autoRenew
                  ? "Your membership will automatically renew at the end of each period using your payment method."
                  : "Autopay is paused. Benefits will end on the expiry date unless renewed."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={autoRenew}
                disabled={updatingAutoRenew}
                onCheckedChange={handleToggleAutoRenew}
              />
            </div>
          </div>

          {membershipExpiry && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Next Renewal Date:
              </span>
              <span className="font-medium text-foreground">
                {new Date(membershipExpiry).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          )}

          {/* ── Cancel Membership Button & Modal ── */}
          <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Need to cancel? You can cancel your membership at any time.
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-9 font-medium"
                  disabled={cancelling}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Cancel Membership
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Cancel CHS Premium Membership?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm text-foreground/80 pt-2">
                      <p>
                        Are you sure you want to cancel your membership?
                      </p>
                      <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 space-y-1 border border-red-100">
                        <p className="font-semibold text-red-900">• Recurring autopay will be revoked immediately.</p>
                        <p className="font-semibold text-red-900">• All member benefits (5% discount up to $30, exclusive member pricing, 3-year warranty) will be revoked immediately.</p>
                        <p>• No further charges will occur.</p>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Membership</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelMembership}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling…
                      </>
                    ) : (
                      "Yes, Cancel Immediately"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* ── Admin / Testing Simulation Panel ── */}
      {isAdmin && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Autopay Testing & Simulation (Admin Only)
            </span>
            <Badge variant="outline" className="text-[10px]">
              Retries: {retryCount}/2
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Test the 2-retry multi-day failure flow. Click failure to trigger Attempt 1 &rarr; Attempt 2 &rarr; Immediate Revocation on 3rd failure stating &ldquo;Payment method failure issue&rdquo;.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSimulate("simulate_failure")}
              disabled={simulating}
              className="text-xs h-8 border-amber-300 text-amber-800 hover:bg-amber-100"
            >
              Simulate Payment Failure ({retryCount < 2 ? `Attempt ${retryCount + 1}` : "Final Revoke"})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSimulate("simulate_success")}
              disabled={simulating}
              className="text-xs h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
            >
              Simulate Successful Renewal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

