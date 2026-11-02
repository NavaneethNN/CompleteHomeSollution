"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink, XCircle, ArrowRight, RefreshCw } from "lucide-react";

export function PollPendingPayment({
  orderId,
  guestToken,
  returnToken,
  maxAttempts = 30,
  intervalMs = 3000,
}: {
  orderId: string;
  guestToken?: string;
  returnToken?: string;
  maxAttempts?: number;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    async function poll() {
      if (stopped) return;
      attempts++;
      try {
        const params = new URLSearchParams();
        if (guestToken) params.set("token", guestToken);
        if (returnToken) params.set("return_token", returnToken);
        const query = params.toString() ? `?${params.toString()}` : "";

        const res = await fetch(`/api/orders/${orderId}/poll-payment${query}`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (stopped) return;

        if (res.status === 202) {
          const data = await res.json();
          if (typeof data.checkoutUrl === "string" && data.checkoutUrl.startsWith("https://")) {
            setCheckoutUrl(data.checkoutUrl);
          }
        }

        // 200 = Paid, 402 = Declined/Cancelled, 409 = Conflict
        if (res.status === 200 || res.status === 402 || res.status === 409) {
          router.refresh();
          return;
        }

        if ([401, 403, 404].includes(res.status)) {
          setTimedOut(true);
          return;
        }
      } catch {
        if (stopped) return;
      }

      if (attempts >= maxAttempts) {
        setTimedOut(true);
        return;
      }

      timer = setTimeout(poll, Math.min(intervalMs * 1.5 ** Math.floor(attempts / 4), 10000));
    }

    timer = setTimeout(poll, intervalMs);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [orderId, guestToken, returnToken, maxAttempts, intervalMs, retry, router]);

  const handleCancelPendingOrder = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    setCancelError(null);

    try {
      const params = new URLSearchParams();
      if (guestToken) params.set("token", guestToken);
      if (returnToken) params.set("return_token", returnToken);
      const query = params.toString() ? `?${params.toString()}` : "";

      const res = await fetch(`/api/orders/${orderId}/cancel${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnToken,
          guestToken,
          reason: "Customer cancelled incomplete checkout",
        }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setCancelError(data.error || "Could not cancel order. Please refresh the page.");
        setIsCancelling(false);
      }
    } catch {
      setCancelError("Network error. Please try again.");
      setIsCancelling(false);
    }
  };

  return (
    <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6 text-foreground space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-amber-900 sm:text-base">
            Payment Not Yet Finalized
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-amber-800 leading-relaxed">
            If you did not complete the payment at the bank, closed the window, or if your card was
            declined, your card was not charged. You can complete it now or cancel this order to try
            again.
          </p>
        </div>
      </div>

      {cancelError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-800">
          {cancelError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
        {checkoutUrl && (
          <a
            href={checkoutUrl}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            Complete Payment on Bank Page
            <ExternalLink className="h-4 w-4" />
          </a>
        )}

        <button
          type="button"
          onClick={handleCancelPendingOrder}
          disabled={isCancelling}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors disabled:opacity-50"
        >
          {isCancelling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
              Cancelling Order…
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-rose-500" />
              I didn&apos;t pay — Cancel Order &amp; Try Again
            </>
          )}
        </button>
      </div>

      {/* Real-time status / Check again */}
      <div className="flex items-center gap-2 text-xs text-amber-800 pt-1 border-t border-amber-200/60">
        {!timedOut ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
            <span>Checking bank status automatically…</span>
          </>
        ) : (
          <>
            <span>Verification paused.</span>
            <button
              type="button"
              onClick={() => {
                setTimedOut(false);
                setRetry((r) => r + 1);
              }}
              className="inline-flex items-center gap-1 font-semibold underline text-amber-900 hover:text-amber-950"
            >
              <RefreshCw className="h-3 w-3" />
              Check bank again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

