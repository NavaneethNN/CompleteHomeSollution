"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function PollPendingPayment({ orderId, guestToken, returnToken, maxAttempts = 20, intervalMs = 3000 }: {
  orderId: string; guestToken?: string; returnToken?: string; maxAttempts?: number; intervalMs?: number;
}) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
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
          credentials: "include", cache: "no-store", signal: controller.signal,
        });
        if (stopped) return;
        if (res.status === 202) {
          const data = await res.json();
          if (typeof data.checkoutUrl === "string" && data.checkoutUrl.startsWith("https://")) setCheckoutUrl(data.checkoutUrl);
        }
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
      timer = setTimeout(poll, Math.min(intervalMs * 2 ** Math.floor(attempts / 4), 15000));
    }
    timer = setTimeout(poll, intervalMs);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [orderId, guestToken, returnToken, maxAttempts, intervalMs, retry, router]);

  return <>{checkoutUrl && <div className="mx-auto mb-4 max-w-2xl p-4"><a className="underline" href={checkoutUrl}>Continue this payment on the secure payment page</a></div>}{timedOut ? <div role="status" className="mx-auto mb-4 max-w-2xl rounded border p-4">
    Payment verification is taking longer than expected. Keep this order reference and do not pay again.
    <button className="ml-2 underline" onClick={() => { setTimedOut(false); setRetry((value) => value + 1); }}>Check again</button>
  </div> : null}</>;
}
