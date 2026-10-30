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
  ShieldCheck,
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

  // 1. Not Logged In State (Clean CHS Style)
  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border border-border bg-[#faf8f5] p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-border shadow-xs flex items-center justify-center text-primary font-bold">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Participate in Giveaway</h3>
            <p className="text-xs text-muted-foreground">Log in or create a free account to enter</p>
          </div>
        </div>

        <div className="space-y-2.5 bg-white rounded-xl p-4 border border-border/80 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>100% Free Entry – No purchase required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Unique verifiable ticket numbers for each entry</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Instant notification if your ticket is selected</span>
          </div>
        </div>

        <Link
          href={`/login?callbackUrl=/raffles/${raffle.slug}`}
          className="mt-5 w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 shadow-xs"
        >
          <LogIn className="h-4 w-4" />
          Log In to Claim Ticket
        </Link>
      </div>
    );
  }

  // 2. Members Only Check (Site VIP Style)
  if (isMemberOnly && !isMemberEligible) {
    return (
      <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-br from-[#1a2233] to-[#0f1422] text-white p-5 sm:p-6 shadow-md">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-xs">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              VIP REWARD
            </span>
            <h3 className="text-lg font-semibold text-white mt-1">VIP Members Only</h3>
          </div>
        </div>

        <p className="text-xs text-white/80 leading-relaxed mt-2">
          This exclusive draw is reserved for active Complete Home Solution VIP Members. Upgrade your account to participate and unlock 5% everyday store discounts, extended 3-year warranty, and member giveaways!
        </p>

        <Link
          href="/account/membership"
          className="mt-5 w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 shadow-xs"
        >
          <Crown className="h-4 w-4" />
          Become a VIP Member
        </Link>
      </div>
    );
  }

  // 3. User is eligible & logged in
  return (
    <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3.5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Get Your Tickets</h3>
            <p className="text-xs text-muted-foreground">
              {isFree ? "100% Free Entry" : `Price: $${raffle.entryPrice} per ticket`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
            Your Entries
          </span>
          <span className="text-base font-bold text-foreground">
            {userParticipation?.totalTickets ?? 0} / {raffle.maxEntriesPerUser}
          </span>
        </div>
      </div>

      {/* Just Obtained Tickets Notification */}
      {successTickets && successTickets.length > 0 && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
          <div className="flex items-center gap-2 font-semibold text-xs mb-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span>Success! You received {successTickets.length} new ticket(s):</span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {successTickets.map((ticketNum, idx) => (
              <div
                key={ticketNum}
                className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-emerald-100 font-mono text-xs font-semibold text-foreground"
              >
                <span>{ticketNum}</span>
                <button
                  type="button"
                  onClick={() => handleCopyTicket(ticketNum, idx)}
                  className="text-muted-foreground hover:text-emerald-700 transition-colors p-1"
                >
                  {copiedIndex === idx ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Tickets List */}
      {userParticipation && userParticipation.tickets.length > 0 && !successTickets && (
        <div className="p-3.5 rounded-xl bg-[#faf8f5] border border-border">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-2">
            <span className="flex items-center gap-1.5 text-emerald-700">
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
            {userParticipation.tickets.map((t) => (
              <span
                key={t.id}
                className="font-mono text-[11px] font-semibold bg-white text-foreground px-2 py-0.5 rounded border border-border"
              >
                {t.ticketNumber}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ticket Selection & CTA */}
      {remaining > 0 ? (
        <div className="space-y-4 pt-1">
          {raffle.allowMultipleEntries && remaining > 1 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                Number of Entries (Up to {remaining} remaining)
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-[#f7f3ed] rounded-full p-1 border border-border">
                  <button
                    type="button"
                    onClick={() => setTicketCount((c) => Math.max(1, c - 1))}
                    disabled={ticketCount <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-foreground disabled:opacity-40 shadow-xs border border-border hover:bg-secondary"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-10 text-center font-bold text-sm text-foreground">
                    {ticketCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTicketCount((c) => Math.min(remaining, c + 1))}
                    disabled={ticketCount >= remaining}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-foreground disabled:opacity-40 shadow-xs border border-border hover:bg-secondary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {ticketCount} ticket{ticketCount > 1 ? "s" : ""} = {ticketCount} chance{ticketCount > 1 ? "s" : ""} to win
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleEnter}
            disabled={loading}
            className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating your ticket...</span>
              </>
            ) : isFree ? (
              <>
                <Gift className="h-4 w-4" />
                <span>Claim {ticketCount > 1 ? `${ticketCount} Free Tickets` : "Free Entry Ticket"}</span>
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4" />
                <span>Enter for ${raffle.entryPrice * ticketCount}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-[#faf8f5] border border-border text-center text-xs text-muted-foreground font-medium">
          You have claimed all {raffle.maxEntriesPerUser} allowed ticket entries for this raffle! Stay tuned for the winner announcement.
        </div>
      )}

      {/* Rules Notice */}
      <p className="text-[11px] text-muted-foreground text-center leading-relaxed pt-1">
        Free promotional draw. Transparent cryptographic random selection. No purchase necessary.
      </p>
    </div>
  );
}
