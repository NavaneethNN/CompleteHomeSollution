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
      <div className={`inline-flex items-center gap-1.5 font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full text-xs border border-rose-200 ${className}`}>
        <Clock className="h-3.5 w-3.5" />
        <span>Entries Closed</span>
      </div>
    );
  }

  if (size === "sm") {
    return (
      <div className={`inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50/90 border border-amber-200/80 px-2.5 py-1 rounded-full shadow-xs ${className}`}>
        <Clock className="h-3.5 w-3.5 text-amber-600 animate-spin" style={{ animationDuration: "8s" }} />
        <span>
          {timeLeft.days > 0 ? `${timeLeft.days}d ` : ""}
          {String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m {String(timeLeft.seconds).padStart(2, "0")}s
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          {label}
        </span>
      )}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex flex-col items-center bg-slate-900 text-white rounded-lg px-2.5 py-1.5 min-w-[46px] shadow-sm">
          <span className="text-base sm:text-lg font-black leading-none">{timeLeft.days}</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Days</span>
        </div>
        <span className="font-bold text-slate-400">:</span>
        <div className="flex flex-col items-center bg-slate-900 text-white rounded-lg px-2.5 py-1.5 min-w-[46px] shadow-sm">
          <span className="text-base sm:text-lg font-black leading-none">{String(timeLeft.hours).padStart(2, "0")}</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Hours</span>
        </div>
        <span className="font-bold text-slate-400">:</span>
        <div className="flex flex-col items-center bg-slate-900 text-white rounded-lg px-2.5 py-1.5 min-w-[46px] shadow-sm">
          <span className="text-base sm:text-lg font-black leading-none">{String(timeLeft.minutes).padStart(2, "0")}</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Mins</span>
        </div>
        <span className="font-bold text-slate-400">:</span>
        <div className="flex flex-col items-center bg-primary text-white rounded-lg px-2.5 py-1.5 min-w-[46px] shadow-sm animate-pulse">
          <span className="text-base sm:text-lg font-black leading-none">{String(timeLeft.seconds).padStart(2, "0")}</span>
          <span className="text-[9px] uppercase tracking-wider text-primary-foreground/80 font-semibold mt-0.5">Secs</span>
        </div>
      </div>
    </div>
  );
}
