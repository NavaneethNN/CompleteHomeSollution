"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type AnimVariant = "fade-up" | "fade-in" | "slide-left" | "slide-right" | "scale-in";

interface AnimateInProps {
  children: React.ReactNode;
  variant?: AnimVariant;
  delay?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  threshold?: number;
}

const VARIANT_CLASS: Record<AnimVariant, string> = {
  "fade-up":     "animate-fade-up",
  "fade-in":     "animate-fade-in",
  "slide-left":  "animate-slide-left",
  "slide-right": "animate-slide-right",
  "scale-in":    "animate-scale-in",
};

export function AnimateIn({
  children,
  variant = "fade-up",
  delay = 0,
  className,
  as: Tag = "div",
  threshold = 0.15,
}: AnimateInProps) {
  const ref = useRef<HTMLElement>(null);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTriggered(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    // @ts-expect-error dynamic tag
    <Tag
      ref={ref}
      className={cn(
        triggered ? VARIANT_CLASS[variant] : "opacity-0",
        className
      )}
      style={triggered && delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
