"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PagePreloader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const prevPathRef = useRef("");
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize prevPathRef on mount
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

    setVisible(true);
    setProgress(18);

    let current = 18;
    progressTimerRef.current = setInterval(() => {
      current += Math.random() * 14 + 4;
      if (current >= 85) {
        current = 85;
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      }
      setProgress(current);
    }, 90);

    // Fail-safe: Preloader NEVER spins longer than 2.5s under any circumstance
    safetyTimerRef.current = setTimeout(() => {
      finishProgress();
    }, 2500);
  }, [finishProgress]);

  // Finish preloader whenever navigation completes
  useEffect(() => {
    const current = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    if (prevPathRef.current && current !== prevPathRef.current) {
      prevPathRef.current = current;
      finishProgress();
    } else {
      prevPathRef.current = current;
    }
  }, [pathname, searchParams, finishProgress]);

  // Intercept valid internal link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignore if event was cancelled
      if (e.defaultPrevented) return;

      // Ignore modifier keys and non-left clicks (e.g. Cmd+click opens new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external protocols
      if (
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        href.startsWith("#")
      ) {
        return;
      }

      // Ignore new window/tab or downloads
      if (target.getAttribute("target") === "_blank" || target.hasAttribute("download")) {
        return;
      }

      try {
        const targetUrl = new URL(target.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        // Ignore cross-origin navigations
        if (targetUrl.origin !== currentUrl.origin) return;

        // Ignore same page clicks (e.g. clicking /products while on /products)
        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }

        // Ignore hash jumps on the same page
        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search &&
          targetUrl.hash
        ) {
          return;
        }

        startProgress();
      } catch {
        // Fallback: do nothing if URL parsing fails
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
      aria-label="Page loading indicator"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
    >
      {/* Top progress bar with brand primary gradient & glow */}
      <div
        className="h-[3px] bg-gradient-to-r from-amber-500 via-primary to-orange-600 shadow-[0_0_10px_rgba(232,93,26,0.6)]"
        style={{
          width: `${progress}%`,
          transition: progress === 100
            ? "width 180ms ease-out, opacity 250ms ease 100ms"
            : "width 90ms ease-out",
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </aside>
  );
}
