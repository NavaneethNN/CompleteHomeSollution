"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RefreshOrderStatus({ orderId, status, updatedAt }: {
  orderId: string;
  status: string;
  updatedAt: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;
    let checking = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    const checkStatus = async () => {
      if (stopped || checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok || stopped) return;
        const result = await response.json();
        const latest = result.data as { status?: string; updatedAt?: string } | undefined;
        if (latest && (latest.status !== status || (latest.updatedAt && latest.updatedAt !== updatedAt))) {
          router.refresh();
        }
      } catch {
        // A temporary refresh failure should not interrupt viewing the order.
      } finally {
        checking = false;
        if (!stopped) timer = setTimeout(checkStatus, 15_000);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void checkStatus();
      }
    };

    timer = setTimeout(checkStatus, 15_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderId, status, updatedAt, router]);

  return null;
}
