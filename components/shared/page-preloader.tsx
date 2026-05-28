"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";

export function PagePreloader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const prevPathRef = useRef(pathname + searchParams.toString());
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const current = pathname + searchParams.toString();

    if (current !== prevPathRef.current) {
      // Navigation completed — fade out
      prevPathRef.current = current;
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      setLoading(false);
      hideTimerRef.current = setTimeout(() => setVisible(false), 400);
    }
  }, [pathname, searchParams]);

  // Show preloader on link clicks (capture phase so we catch it before navigation)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;
      // Only trigger for internal, non-hash, non-external links
      if (
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !target.getAttribute("download") &&
        !target.getAttribute("target")
      ) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setVisible(true);
        // Small delay so instant navigations don't flash
        showTimerRef.current = setTimeout(() => setLoading(true), 80);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
      style={{
        opacity: loading ? 1 : 0,
        transition: "opacity 350ms ease",
        pointerEvents: loading ? "all" : "none",
      }}
    >
      {/* Spinner ring */}
      <div className="relative flex items-center justify-center">
        {/* Outer spinning arc */}
        <svg
          className="absolute animate-spin"
          width="96"
          height="96"
          viewBox="0 0 96 96"
          fill="none"
          style={{ animationDuration: "900ms" }}
        >
          <circle
            cx="48"
            cy="48"
            r="44"
            stroke="#e5e7eb"
            strokeWidth="5"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r="44"
            stroke="var(--color-primary, #e85d1a)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="276"
            strokeDashoffset="207"
          />
        </svg>

        {/* Logo in centre */}
        <div className="relative z-10 flex items-center justify-center w-16 h-16">
          <Image
            src="/chs-logo.png"
            alt="Loading…"
            width={430}
            height={131}
            className="w-14 h-auto object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}
