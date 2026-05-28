"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ─── Revenue Bar Chart ────────────────────────────────────────────────────────

export interface MonthlyDataPoint {
  month: string;   // "Jan", "Feb", ...
  revenue: number;
  orders: number;
}

interface RevenueBarChartProps {
  data: MonthlyDataPoint[];
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [tab, setTab] = useState<"revenue" | "orders">("revenue");

  const values = data.map((d) => (tab === "revenue" ? d.revenue : d.orders));
  const max = Math.max(...values, 1);

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["revenue", "orders"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              tab === t
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "revenue" ? "Revenue" : "Orders"}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Y-axis grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
          {[100, 75, 50, 25, 0].map((pct) => (
            <div key={pct} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">
                {tab === "revenue"
                  ? max > 0 ? currencyFormatter.format((max * pct) / 100) : "0"
                  : Math.round((max * pct) / 100)}
              </span>
              <div className="flex-1 border-t border-dashed border-border" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="ml-12 flex items-end gap-1.5 sm:gap-2 h-52 pb-8">
          {data.map((d, i) => {
            const val = tab === "revenue" ? d.revenue : d.orders;
            const heightPct = max > 0 ? (val / max) * 100 : 0;
            const isHovered = hovered === i;

            return (
              <div
                key={d.month}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end group"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute -translate-y-1 z-10 bg-foreground text-background text-[10px] font-semibold px-2 py-1 rounded-md shadow-lg whitespace-nowrap pointer-events-none"
                    style={{ bottom: `calc(${heightPct}% + 2.5rem)` }}
                  >
                    {tab === "revenue" ? currencyFormatter.format(val) : `${val} orders`}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-foreground" />
                  </div>
                )}

                {/* Bar */}
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-200 cursor-default",
                    isHovered ? "bg-primary" : "bg-primary/60"
                  )}
                  style={{ height: `${Math.max(heightPct, val > 0 ? 2 : 0)}%` }}
                />

                {/* Label */}
                <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 select-none">
                  {d.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Donut / Ring Chart ───────────────────────────────────────────────────────

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  total: number;
  centerLabel?: string;
}

export function DonutChart({ segments, total, centerLabel }: DonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const size = 140;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const startOffset = circumference - offset * circumference;
    offset += pct;
    return { ...seg, dash, gap, startOffset };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* SVG donut */}
      <div className="relative shrink-0">
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/40"
          />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={hovered === arc.label ? strokeWidth + 3 : strokeWidth}
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={arc.startOffset}
              strokeLinecap="butt"
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={() => setHovered(arc.label)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-foreground">{total}</span>
          {centerLabel && (
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{centerLabel}</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 w-full">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div
              key={seg.label}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors cursor-default",
                hovered === seg.label ? "bg-muted" : ""
              )}
              onMouseEnter={() => setHovered(seg.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-xs text-foreground font-medium flex-1">{seg.label}</span>
              <span className="text-xs font-bold text-foreground">{seg.value}</span>
              <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Horizontal Bar Chart (Top Products / Categories) ────────────────────────

export interface HorizontalBarItem {
  label: string;
  value: number;
  sub?: string;
  color?: string;
}

const audFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface HorizontalBarChartProps {
  items: HorizontalBarItem[];
  format?: "currency" | "number";
  colorClass?: string;
}

export function HorizontalBarChart({
  items,
  format = "number",
  colorClass = "bg-primary",
}: HorizontalBarChartProps) {
  const formatter = format === "currency" ? (v: number) => audFormatter.format(v) : (v: number) => v.toLocaleString();
  const max = Math.max(...items.map((i) => i.value), 1);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div
          key={item.label}
          className="space-y-1 cursor-default"
          onMouseEnter={() => setHovered(item.label)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">
                {idx + 1}
              </span>
              <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
              {item.sub && (
                <span className="text-[10px] text-muted-foreground shrink-0">{item.sub}</span>
              )}
            </div>
            <span className="text-xs font-bold text-foreground shrink-0">
              {formatter(item.value)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                item.color ? "" : colorClass,
                hovered === item.label ? "opacity-100" : "opacity-75"
              )}
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export function Sparkline({ data, color = "#6366f1", height = 36, width = 80 }: SparklineProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
