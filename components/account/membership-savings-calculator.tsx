"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Tag, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface SavingsCalculatorProps {
  planPrice: number;
  planDuration: string;
  checkoutUrl?: string;
  isMember?: boolean;
}

const PRESET_SPENDS = [
  { label: "Lamp / Table", amount: 250 },
  { label: "Queen Bed", amount: 600 },
  { label: "Dining Suite", amount: 950 },
  { label: "Lounge Sofa", amount: 1600 },
];

export function MembershipSavingsCalculator({
  planPrice,
  planDuration,
  checkoutUrl,
  isMember = false,
}: SavingsCalculatorProps) {
  const [spend, setSpend] = useState<number>(600);

  // 5% discount up to $30 max per order
  const calculatedDiscount = Math.min(spend * 0.05, 30);
  const netOrderCost = spend - calculatedDiscount;
  const warrantyValue = 99; // Value of 3-year extended warranty
  const totalValue = calculatedDiscount + warrantyValue;
  const netProfit = calculatedDiscount - planPrice;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-5 sm:p-7 md:p-9">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            Interactive Savings Calculator
          </span>
          <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Calculate your day-one savings
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Slide to your furniture budget to see your instant discount and warranty value.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 bg-secondary/80 border border-border rounded-full px-4 py-1.5 self-start sm:self-center shrink-0">
          <span className="text-xs text-muted-foreground">VIP Pass:</span>
          <span className="text-sm font-bold text-foreground">
            ${planPrice} <span className="text-xs font-normal text-muted-foreground">/{planDuration}</span>
          </span>
        </div>
      </div>

      {/* Preset pills for fast tap on mobile */}
      <div className="mb-5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Popular purchase examples:
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_SPENDS.map((preset) => (
            <button
              key={preset.amount}
              type="button"
              onClick={() => setSpend(preset.amount)}
              className={`text-xs px-3.5 py-1.5 rounded-full transition-colors active:scale-95 ${
                spend === preset.amount
                  ? "bg-primary text-white font-semibold shadow-sm"
                  : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
              }`}
            >
              {preset.label} (${preset.amount})
            </button>
          ))}
        </div>
      </div>

      {/* Slider input */}
      <div className="bg-secondary/40 rounded-xl p-4 sm:p-5 border border-border/60 mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <label htmlFor="spend-slider" className="text-xs sm:text-sm font-medium text-foreground">
            Your furniture order total:
          </label>
          <span className="text-2xl sm:text-3xl font-bold text-primary">
            ${spend.toLocaleString()}
          </span>
        </div>

        <input
          id="spend-slider"
          type="range"
          min="100"
          max="2500"
          step="50"
          value={spend}
          onChange={(e) => setSpend(Number(e.target.value))}
          className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
        />

        <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
          <span>$100 spend</span>
          <span className="text-primary font-medium">$600 (Max $30 discount cap)</span>
          <span>$2,500 spend</span>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {/* Instant Discount */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-xs flex sm:flex-col justify-between items-center sm:items-start">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <span>Instant 5% VIP Discount</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-primary">
              -${calculatedDiscount.toFixed(2)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {calculatedDiscount >= 30 ? "Max $30 cap reached" : "5% deducted at checkout"}
            </p>
          </div>
          <div className="text-right sm:text-left sm:mt-3 pt-0 sm:pt-2 sm:border-t sm:border-border/60">
            <span className="text-xs text-muted-foreground block">You pay</span>
            <span className="text-sm font-bold text-foreground">${netOrderCost.toFixed(2)}</span>
          </div>
        </div>

        {/* 3-Year Extended Warranty */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-xs flex sm:flex-col justify-between items-center sm:items-start">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
              <span>3-Year Warranty</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-amber-600">
              FREE
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Normally $99 standalone value
            </p>
          </div>
          <div className="text-right sm:text-left sm:mt-3 pt-0 sm:pt-2 sm:border-t sm:border-border/60">
            <span className="text-xs text-muted-foreground block">Coverage</span>
            <span className="text-sm font-semibold text-foreground">Frames & joinery</span>
          </div>
        </div>

        {/* Total Day-1 Value */}
        <div className="bg-gradient-to-br from-primary/10 via-white to-secondary/60 rounded-xl p-4 border border-primary/25 shadow-xs flex sm:flex-col justify-between items-center sm:items-start">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Total Day-1 VIP Value</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">
              ${totalValue.toFixed(0)}+
            </p>
            <p className="text-[11px] font-medium text-emerald-700 mt-0.5">
              {netProfit >= 0 ? (
                `✓ Pays for membership + $${netProfit.toFixed(0)} saved`
              ) : (
                `Saves $${calculatedDiscount.toFixed(0)} toward your pass`
              )}
            </p>
          </div>
          <div className="text-right sm:text-left sm:mt-3 pt-0 sm:pt-2 sm:border-t sm:border-primary/20">
            <span className="text-xs text-muted-foreground block">Dispatch</span>
            <span className="text-sm font-semibold text-foreground">Priority queue</span>
          </div>
        </div>
      </div>

      {/* Bottom CTA for non-members */}
      {!isMember && checkoutUrl && (
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Discount applies immediately at checkout today and for 365 days.</span>
          </div>

          <Link
            href={checkoutUrl}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 shadow-sm text-center"
          >
            Join VIP (${planPrice}/{planDuration}) <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
