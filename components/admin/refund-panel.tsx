"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, DollarSign, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orderId: string;
  orderTotal: number;
  refundRequested: boolean;
  refundReason: string | null;
  alreadyRefunded: boolean;
  refundAmount: number | null;
  refundedAt: Date | null;
  hasStripePayment: boolean;
}

export function AdminRefundPanel({
  orderId,
  orderTotal,
  refundRequested,
  refundReason,
  alreadyRefunded,
  refundAmount,
  refundedAt,
  hasStripePayment,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState(orderTotal.toFixed(2));
  const [restoreStock, setRestoreStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (alreadyRefunded && refundAmount != null) {
    return (
      <div className="flex items-start gap-3 bg-slate-50 rounded-xl border border-slate-200 p-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-slate-900">Refund processed</p>
          <p className="text-slate-500">A${refundAmount.toFixed(2)} refunded{refundedAt ? ` on ${new Date(refundedAt).toLocaleDateString("en-AU")}` : ""}</p>
        </div>
      </div>
    );
  }

  async function handleRefund() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid refund amount");
      return;
    }
    if (parsed > orderTotal) {
      toast.error(`Cannot exceed order total (A$${orderTotal.toFixed(2)})`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: parsed, restoreStock }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refund failed");
      toast.success(`A$${parsed.toFixed(2)} refunded successfully`);
      setConfirmed(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!hasStripePayment) {
    return (
      <div className="text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200 p-4">
        No Stripe payment on record — refund must be handled manually.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refund request alert */}
      {refundRequested && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800">Customer requested a refund</p>
            {refundReason && <p className="text-amber-700 mt-1">Reason: {refundReason}</p>}
          </div>
        </div>
      )}

      {/* Refund form */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
            Refund Amount (AUD)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="number"
              min="0.01"
              max={orderTotal}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={() => setAmount(orderTotal.toFixed(2))}
              className="text-xs text-blue-600 hover:underline"
            >
              Full refund (A${orderTotal.toFixed(2)})
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={restoreStock}
            onChange={(e) => setRestoreStock(e.target.checked)}
            className="rounded border-slate-300"
          />
          <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
          Restore stock to inventory
        </label>

        {!confirmed ? (
          <button
            onClick={() => setConfirmed(true)}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Issue Refund
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Confirm issuing a <strong>A${parseFloat(amount || "0").toFixed(2)}</strong> refund via Stripe? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmed(false)}
                disabled={loading}
                className="flex-1 py-2.5 border border-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Refund
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
