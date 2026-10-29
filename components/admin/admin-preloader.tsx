"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function AdminPreloader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const prevPathRef = useRef("");
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    prevPathRef.current = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
  }, []);

  const finishProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, []);

  const startProgress = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    setProgress(20);
    setVisible(true);

    let current = 20;
    progressTimerRef.current = setInterval(() => {
      current += Math.random() * 12 + 4;
      if (current >= 85) {
        current = 85;
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      }
      setProgress(current);
    }, 80);

    // Safety timeout: dismiss after 2.5s maximum
    safetyTimerRef.current = setTimeout(() => {
      finishProgress();
    }, 2500);
  }, [finishProgress]);

  // Detect completed navigation
  useEffect(() => {
    const current = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    if (prevPathRef.current && current !== prevPathRef.current) {
      prevPathRef.current = current;
      finishProgress();
    } else {
      prevPathRef.current = current;
    }
  }, [pathname, searchParams, finishProgress]);

  // Detect clicks on internal links inside the admin panel
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;

      if (
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        href.startsWith("#")
      ) {
        return;
      }

      if (target.getAttribute("download") || target.getAttribute("target") === "_blank") {
        return;
      }

      try {
        const targetUrl = new URL(target.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        if (targetUrl.origin !== currentUrl.origin) return;
        if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) return;

        startProgress();
      } catch {
        // Fallback
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, [startProgress]);

  if (!visible) return null;

  return (
    <aside
      aria-label="Admin loading indicator"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
    >
      {/* Top progress bar */}
      <div className="h-[3px]">
        <div
          className="h-full bg-primary shadow-[0_0_8px_2px_var(--color-primary)]"
          style={{
            width: `${progress}%`,
            transition: progress === 100
              ? "width 180ms ease-out, opacity 250ms ease 100ms"
              : "width 80ms linear",
            opacity: progress >= 100 ? 0 : 1,
          }}
        />
      </div>
    </aside>
  );
}
