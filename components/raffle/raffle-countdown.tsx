"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownProps {
  targetDate: string | Date;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function RaffleCountdown({
  targetDate,
  label = "Draw Closes In",
  className = "",
  size = "md",
}: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null);

  useEffect(() => {
    function calculate() {
      const target = new Date(targetDate).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
        <Clock className="h-3.5 w-3.5" />
        <span>Calculating time...</span>
      </div>
    );
  }

  if (timeLeft.isExpired) {
    return (
      <div className={`inline-flex items-center gap-1.5 font-semibold text-muted-foreground bg-secondary px-3 py-1 rounded-full text-xs border border-border ${className}`}>
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span>Entries Closed</span>
      </div>
    );
  }

  if (size === "sm") {
    return (
      <div className={`inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-foreground bg-white/95 backdrop-blur-xs border border-border/80 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow-xs whitespace-nowrap ${className}`}>
        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
        <span>
          {timeLeft.days > 0 ? `${timeLeft.days}d ` : ""}
          {String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m {String(timeLeft.seconds).padStart(2, "0")}s
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          {label}
        </span>
      )}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex flex-col items-center bg-[#f7f3ed] border border-border/80 text-foreground rounded-xl px-2.5 py-2 min-w-[50px] shadow-xs">
          <span className="text-base sm:text-lg font-bold leading-none">{timeLeft.days}</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mt-1">Days</span>
        </div>
        <span className="font-bold text-muted-foreground/60">:</span>
        <div className="flex flex-col items-center bg-[#f7f3ed] border border-border/80 text-foreground rounded-xl px-2.5 py-2 min-w-[50px] shadow-xs">
          <span className="text-base sm:text-lg font-bold leading-none">{String(timeLeft.hours).padStart(2, "0")}</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mt-1">Hours</span>
        </div>
        <span className="font-bold text-muted-foreground/60">:</span>
        <div className="flex flex-col items-center bg-[#f7f3ed] border border-border/80 text-foreground rounded-xl px-2.5 py-2 min-w-[50px] shadow-xs">
          <span className="text-base sm:text-lg font-bold leading-none">{String(timeLeft.minutes).padStart(2, "0")}</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mt-1">Mins</span>
        </div>
        <span className="font-bold text-muted-foreground/60">:</span>
        <div className="flex flex-col items-center bg-primary/10 border border-primary/20 text-primary rounded-xl px-2.5 py-2 min-w-[50px] shadow-xs">
          <span className="text-base sm:text-lg font-bold leading-none">{String(timeLeft.seconds).padStart(2, "0")}</span>
          <span className="text-[9px] uppercase tracking-wider text-primary/80 font-medium mt-1">Secs</span>
        </div>
      </div>
    </div>
  );
}
