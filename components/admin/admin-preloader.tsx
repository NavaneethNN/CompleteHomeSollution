"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function AdminPreloader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathRef = useRef(pathname + searchParams.toString());
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startProgress() {
    setProgress(0);
    setVisible(true);
    // Animate bar to ~85% quickly, then stall waiting for navigation to complete
    let current = 0;
    progressTimerRef.current = setInterval(() => {
      current += Math.random() * 12 + 4;
      if (current >= 85) {
        current = 85;
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      }
      setProgress(current);
    }, 80);
  }

  function finishProgress() {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 350);
  }

  // Detect completed navigation
  useEffect(() => {
    const current = pathname + searchParams.toString();
    if (current !== prevPathRef.current) {
      prevPathRef.current = current;
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      finishProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Detect clicks on internal links inside the admin panel
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;
      if (
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !target.getAttribute("download") &&
        !target.getAttribute("target")
      ) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        // Small delay so instant same-page clicks don't flash
        showTimerRef.current = setTimeout(startProgress, 80);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Top progress bar */}
      <div
        className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px]"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="h-full bg-primary shadow-[0_0_8px_2px_var(--color-primary)]"
          style={{
            width: `${progress}%`,
            transition: progress === 100
              ? "width 200ms ease-out"
              : "width 80ms linear",
            opacity: progress >= 100 ? 0 : 1,
          }}
        />
      </div>

      {/* Content area overlay — only covers main, not sidebar/header */}
      <div
        className="fixed inset-0 z-[9998] flex items-center justify-center"
        style={{
          backgroundColor: "rgba(0,0,0,0.18)",
          backdropFilter: "blur(1px)",
          opacity: progress < 100 ? 1 : 0,
          transition: "opacity 300ms ease",
          pointerEvents: progress < 100 ? "all" : "none",
        }}
      >
        {/* Spinner card */}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background/95 px-8 py-6 shadow-2xl">
          <svg
            className="animate-spin"
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            style={{ animationDuration: "700ms" }}
          >
            <circle cx="18" cy="18" r="15" stroke="#e5e7eb" strokeWidth="3" fill="none" />
            <circle
              cx="18"
              cy="18"
              r="15"
              stroke="var(--color-primary, #e85d1a)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="94"
              strokeDashoffset="70"
            />
          </svg>
          <span className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
            Loading…
          </span>
        </div>
      </div>
    </>
  );
}
