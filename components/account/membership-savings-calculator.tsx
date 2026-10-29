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
  { label: "Coffee Table / Lamp", amount: 250 },
  { label: "Queen Bed Frame", amount: 600 },
  { label: "Dining Suite", amount: 950 },
  { label: "Sectional Sofa Lounge", amount: 1600 },
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
  const netFirstOrderProfit = calculatedDiscount - planPrice;

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-amber-500/20 shadow-2xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-400/15 text-amber-300 text-xs font-bold px-3 py-1 rounded-full mb-3 border border-amber-400/30">
              <Sparkles className="h-3.5 w-3.5" />
              INTERACTIVE SAVINGS CALCULATOR
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              See How Much You Save on Day 1
            </h3>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Adjust your furniture budget below to see your instant 5% discount, extended warranty coverage, and net first-order savings.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 px-4 backdrop-blur-sm self-start md:self-auto">
            <span className="text-xs text-slate-400 block font-medium">Annual VIP Pass</span>
            <span className="text-xl font-bold text-amber-400">
              ${planPrice} <span className="text-xs text-slate-400 font-normal">/ {planDuration}</span>
            </span>
          </div>
        </div>

        {/* Preset spend buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs font-semibold text-slate-400 self-center mr-1">Quick Select:</span>
          {PRESET_SPENDS.map((preset) => (
            <button
              key={preset.amount}
              type="button"
              onClick={() => setSpend(preset.amount)}
              className={`text-xs font-medium px-3.5 py-1.5 rounded-full transition-all ${
                spend === preset.amount
                  ? "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              }`}
            >
              {preset.label} (${preset.amount})
            </button>
          ))}
        </div>

        {/* Spend Range Slider */}
        <div className="mb-8">
          <div className="flex justify-between items-baseline mb-2">
            <label htmlFor="spend-slider" className="text-sm font-semibold text-slate-300">
              Your Furniture Purchase Amount:
            </label>
            <span className="text-2xl sm:text-3xl font-black text-white">
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
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
            <span>$100</span>
            <span>$600 (Max $30 Discount Cap)</span>
            <span>$2,500</span>
          </div>
        </div>

        {/* Calculation Result Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Card 1: Instant Discount */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Instant 5% VIP Discount</span>
                <Tag className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-3xl font-black text-emerald-400">
                -${calculatedDiscount.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {calculatedDiscount >= 30 ? "(Reached max $30 cap per order)" : "Applied automatically at checkout"}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 text-xs text-slate-300 font-medium">
              You pay: <span className="font-bold text-white">${netOrderCost.toFixed(2)}</span>
            </div>
          </div>

          {/* Card 2: 3-Year Warranty Value */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>3-Year Extended Warranty</span>
                <ShieldCheck className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-3xl font-black text-amber-300">
                FREE
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Double standard coverage ($99 standalone value)
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 text-xs text-slate-300 font-medium">
              Timber, frames & springs covered
            </div>
          </div>

          {/* Card 3: Net Day-1 Benefit */}
          <div className="bg-gradient-to-br from-amber-500/20 to-primary/20 border border-amber-400/40 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-amber-300 mb-1 font-semibold">
                <span>Total Day-1 VIP Value</span>
                <Sparkles className="h-4 w-4 text-amber-300" />
              </div>
              <p className="text-3xl font-black text-white">
                ${totalValue.toFixed(0)}+
              </p>
              <p className="text-xs text-amber-200/80 mt-1 font-medium">
                {netFirstOrderProfit >= 0 ? (
                  <span className="text-emerald-300 font-bold">
                    ✓ Pays for membership + saves you ${netFirstOrderProfit.toFixed(0)} more!
                  </span>
                ) : (
                  <span>Saves ${calculatedDiscount.toFixed(0)} toward your ${planPrice} pass</span>
                )}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-400/20 text-xs text-amber-200 font-medium">
              + Priority VIP dispatch included
            </div>
          </div>
        </div>

        {/* CTA Footer */}
        {!isMember && checkoutUrl && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Discount kicks in instantly on this purchase & every future order for 365 days.
              </span>
            </div>

            <Link
              href={checkoutUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm px-7 py-3 rounded-xl shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-0.5"
            >
              Join VIP Now (${planPrice}/{planDuration})
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
