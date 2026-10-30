"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { enterRaffle } from "@/lib/actions/raffle";
import {
  Ticket,
  CheckCircle2,
  AlertCircle,
  Crown,
  Loader2,
  Gift,
  Plus,
  Minus,
  Sparkles,
  LogIn,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface EntryWidgetProps {
  raffle: {
    id: string;
    slug: string;
    status: string;
    entryPrice: number;
    isPaid: boolean;
    visibility: string;
    maxEntriesPerUser: number;
    minEntriesPerUser: number;
    totalMaxEntries?: number | null;
    totalTickets: number;
    allowMultipleEntries: boolean;
  };
  userParticipation: {
    totalTickets: number;
    entries: any[];
    tickets: any[];
    wins: any[];
    isMember: boolean;
    isEligibleMember: boolean;
    remainingAllowedEntries: number;
  } | null;
  isLoggedIn: boolean;
}

export function RaffleEntryWidget({
  raffle,
  userParticipation,
  isLoggedIn,
}: EntryWidgetProps) {
  const router = useRouter();
  const [ticketCount, setTicketCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successTickets, setSuccessTickets] = useState<string[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const remaining = userParticipation?.remainingAllowedEntries ?? raffle.maxEntriesPerUser;
  const isFree = raffle.entryPrice === 0;
  const isMemberOnly = raffle.visibility === "MEMBERS_ONLY";
  const userIsMember = userParticipation?.isMember;
  const isMemberEligible = userParticipation?.isEligibleMember ?? true;

  const handleCopyTicket = (ticketNum: string, idx: number) => {
    navigator.clipboard.writeText(ticketNum);
    setCopiedIndex(idx);
    toast.success("Ticket number copied!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleEnter = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/raffles/${raffle.slug}`);
      return;
    }

    if (isMemberOnly && !isMemberEligible) {
      toast.error("This raffle is exclusively for VIP Members.");
      return;
    }

    if (remaining <= 0) {
      toast.error("You have already reached the maximum entry limit for this raffle.");
      return;
    }

    setLoading(true);
    try {
      const res = await enterRaffle(raffle.id, ticketCount);
      if (res.success) {
        setSuccessTickets(res.ticketNumbers ?? []);
        toast.success(res.message || "Entry confirmed! Good luck!");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to participate.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // 1. Not Logged In State
  if (!isLoggedIn) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black">Participate in Giveaway</h3>
            <p className="text-xs text-slate-300">Log in or create a free account to enter</p>
          </div>
        </div>

        <div className="space-y-3 bg-white/5 rounded-2xl p-4 border border-white/10 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>100% Free Entry – No purchase required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Unique verifiable ticket numbers for each entry</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Automatic notification if your ticket is selected</span>
          </div>
        </div>

        <Link
          href={`/login?callbackUrl=/raffles/${raffle.slug}`}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-black text-sm bg-primary text-white hover:bg-primary/90 shadow-lg hover:shadow-primary/20 transition-all hover:scale-[1.01]"
        >
          <LogIn className="h-4 w-4" />
          Log In / Sign Up to Enter
        </Link>
      </div>
    );
  }

  // 2. Members Only Check
  if (isMemberOnly && !isMemberEligible) {
    return (
      <div className="bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-500/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Exclusive VIP Reward
            </span>
            <h3 className="text-xl font-black mt-1">VIP Members Only</h3>
          </div>
        </div>

        <p className="text-xs text-amber-100/80 leading-relaxed mt-2">
          This exclusive draw is reserved for active Complete Home Sollution VIP Members. Upgrade your account to participate and unlock 5% everyday store discounts, free shipping vouchers, and member-only giveaways!
        </p>

        <Link
          href="/account/membership"
          className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01]"
        >
          <Crown className="h-4 w-4 fill-slate-950" />
          Become a VIP Member
        </Link>
      </div>
    );
  }

  // 3. User is eligible & logged in
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-border">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-foreground">Get Your Tickets</h3>
            <p className="text-xs text-muted-foreground">
              {isFree ? "Free Entry" : `Price: $${raffle.entryPrice} per ticket`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
            Your Tickets
          </span>
          <span className="text-lg font-black text-primary">
            {userParticipation?.totalTickets ?? 0} / {raffle.maxEntriesPerUser}
          </span>
        </div>
      </div>

      {/* Just Obtained Tickets Celebration */}
      {successTickets && successTickets.length > 0 && (
        <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
          <div className="flex items-center gap-2 font-bold text-sm mb-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span>Success! You received {successTickets.length} new ticket(s):</span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {successTickets.map((ticketNum, idx) => (
              <div
                key={ticketNum}
                className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-emerald-100 font-mono text-xs font-bold text-slate-800"
              >
                <span>{ticketNum}</span>
                <button
                  type="button"
                  onClick={() => handleCopyTicket(ticketNum, idx)}
                  className="text-slate-400 hover:text-emerald-700 transition-colors"
                >
                  {copiedIndex === idx ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Tickets List */}
      {userParticipation && userParticipation.tickets.length > 0 && !successTickets && (
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              You are entered in this draw
            </span>
            <Link
              href="/account/raffles"
              className="text-primary hover:underline text-[11px]"
            >
              View in My Raffles
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {userParticipation.tickets.map((t, idx) => (
              <span
                key={t.id}
                className="font-mono text-[11px] font-bold bg-white text-slate-800 px-2 py-0.5 rounded-md border border-slate-200"
              >
                {t.ticketNumber}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ticket Selection & CTA */}
      {remaining > 0 ? (
        <div className="mt-6 space-y-4">
          {raffle.allowMultipleEntries && remaining > 1 && (
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Number of Entries (Up to {remaining} remaining)
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTicketCount((c) => Math.max(1, c - 1))}
                    disabled={ticketCount <= 1}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-slate-800 disabled:opacity-40 shadow-xs"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center font-black text-base text-slate-900">
                    {ticketCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTicketCount((c) => Math.min(remaining, c + 1))}
                    disabled={ticketCount >= remaining}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-slate-800 disabled:opacity-40 shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {ticketCount} ticket{ticketCount > 1 ? "s" : ""} = {ticketCount} chance{ticketCount > 1 ? "s" : ""} to win
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleEnter}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-black text-base bg-primary text-white hover:bg-primary/95 shadow-lg hover:shadow-primary/25 disabled:opacity-60 transition-all hover:scale-[1.01]"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating your ticket...</span>
              </>
            ) : isFree ? (
              <>
                <Gift className="h-5 w-5 text-amber-300" />
                <span>Claim {ticketCount > 1 ? `${ticketCount} Free Tickets` : "Free Entry Ticket"}</span>
              </>
            ) : (
              <>
                <Ticket className="h-5 w-5" />
                <span>Enter for ${raffle.entryPrice * ticketCount}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-center text-xs font-semibold">
          You have claimed all {raffle.maxEntriesPerUser} allowed ticket entries for this raffle! Stay tuned for the winner announcement.
        </div>
      )}

      {/* Rules Notice */}
      <p className="mt-4 text-[11px] text-muted-foreground text-center leading-relaxed">
        Free promotional draw. Winners chosen by transparent cryptographic random selection. No purchase necessary.
      </p>
    </div>
  );
}

