"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orderId: string;
  orderTotal: number;
  isPreShip: boolean; // true = auto-refund, false = request only
  alreadyRequested: boolean;
}

export function CancelOrderButton({ orderId, orderTotal, isPreShip, alreadyRequested }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (alreadyRequested) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="font-medium">Refund request submitted — awaiting admin review</span>
      </div>
    );
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel order");

      if (data.autoRefunded) {
        toast.success(`Order cancelled. Refund of A$${data.refundAmount.toFixed(2)} issued automatically.`);
      } else {
        toast.success("Refund request submitted. Our team will review it within 1–2 business days.");
      }
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl px-4 py-3 transition-colors w-full justify-center"
      >
        <XCircle className="h-4 w-4" />
        {isPreShip ? "Cancel Order & Get Refund" : "Request Refund"}
      </button>

      {/* Confirmation modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">
                  {isPreShip ? "Cancel & Refund Order?" : "Request a Refund?"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {isPreShip
                    ? `A full refund of A$${orderTotal.toFixed(2)} will be automatically issued to your payment method.`
                    : "Your order has already shipped. Our team will review your request and respond within 1–2 business days."}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Reason <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Changed my mind, ordered by mistake..."
                rows={3}
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPreShip ? "Cancel & Refund" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
