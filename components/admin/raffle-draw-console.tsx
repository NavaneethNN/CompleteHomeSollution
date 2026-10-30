"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Gift,
  Ticket,
  Dices,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Edit,
  Play,
  Pause,
  Save,
  Loader2,
  Users,
  ShieldCheck,
  MapPin,
  Calendar,
  Clock,
  Send,
} from "lucide-react";
import {
  conductRaffleDraw,
  approveAndAnnounceWinners,
  redrawSingleWinner,
  updatePrizeFulfilment,
  updateRaffleStatus,
} from "@/lib/actions/admin-raffle";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ConsoleProps {
  raffle: any;
}

export function RaffleDrawConsole({ raffle }: ConsoleProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"WINNERS" | "FULFILMENT" | "TICKETS" | "AUDIT">("WINNERS");
  const [allowMultipleWins, setAllowMultipleWins] = useState(false);
  const [drawLoading, setDrawLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Redraw modal state
  const [redrawWinnerTarget, setRedrawWinnerTarget] = useState<any | null>(null);
  const [redrawReason, setRedrawReason] = useState("");

  // Fulfilment editing state
  const [editingFulfilment, setEditingFulfilment] = useState<{
    winnerId: string;
    carrier: string;
    trackingNumber: string;
    deliveryStatus: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED";
    notes: string;
  } | null>(null);

  // Conduct the draw
  const handleExecuteDraw = async () => {
    if (raffle.tickets.length === 0) {
      toast.error("Cannot conduct draw: No participants have entered this raffle yet.");
      return;
    }

    setDrawLoading(true);
    try {
      const res = await conductRaffleDraw(raffle.id, { allowMultipleWinsPerUser: allowMultipleWins });
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to conduct draw");
      }
    } catch (err: any) {
      toast.error(err.message || "Draw execution error");
    } finally {
      setDrawLoading(false);
    }
  };

  // Approve & Announce
  const handleApproveWinners = async () => {
    setActionLoading(true);
    try {
      const res = await approveAndAnnounceWinners(raffle.id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to announce winners");
      }
    } catch (err: any) {
      toast.error(err.message || "Approval error");
    } finally {
      setActionLoading(false);
    }
  };

  // Redraw single winner
  const handleConfirmRedraw = async () => {
    if (!redrawWinnerTarget || !redrawReason.trim()) {
      toast.error("Please provide a reason for replacing this winner.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await redrawSingleWinner(redrawWinnerTarget.id, redrawReason);
      if (res.success) {
        toast.success(res.message);
        setRedrawWinnerTarget(null);
        setRedrawReason("");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to redraw winner");
      }
    } catch (err: any) {
      toast.error(err.message || "Redraw error");
    } finally {
      setActionLoading(false);
    }
  };

  // Save Fulfilment / Tracking
  const handleSaveFulfilment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFulfilment) return;

    setActionLoading(true);
    try {
      const res = await updatePrizeFulfilment(editingFulfilment);
      if (res.success) {
        toast.success(res.message);
        setEditingFulfilment(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update tracking");
      }
    } catch (err: any) {
      toast.error(err.message || "Update error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickStatus = async (status: string) => {
    setActionLoading(true);
    try {
      const res = await updateRaffleStatus(raffle.id, status);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch (err: any) {
      toast.error(err.message || "Error updating status");
    } finally {
      setActionLoading(false);
    }
  };

  const totalPrizeSlots = raffle.prizes.reduce((sum: number, p: any) => sum + p.quantity, 0);

  return (
    <div className="space-y-6 pb-20">
      {/* ── Top Overview Banner ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-slate-900 text-white">
                Status: {raffle.status}
              </span>
              {raffle.winnersAnnounced ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Winners Publicly Announced
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                  <Clock className="h-3.5 w-3.5" />
                  Not Yet Announced
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              {raffle.title}
            </h1>

            <p className="text-xs text-muted-foreground flex items-center gap-3">
              <span>Slug: <strong className="font-mono text-slate-800">{raffle.slug}</strong></span>
              <span>•</span>
              <span>Draw Date: <strong>{new Date(raffle.drawDate).toLocaleString("en-AU")}</strong></span>
            </p>
          </div>

          {/* Quick Actions Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <Link
              href={`/raffles/${raffle.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Customer View</span>
            </Link>

            <Link
              href={`/admin/raffles/${raffle.id}/edit`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </Link>

            {raffle.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => handleQuickStatus("DRAW_PENDING")}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-xs hover:bg-amber-400 transition-colors"
              >
                <span>Close Entries for Draw</span>
              </button>
            )}

            {raffle.status === "PAUSED" && (
              <button
                type="button"
                onClick={() => handleQuickStatus("ACTIVE")}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs hover:bg-emerald-500 transition-colors"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Resume</span>
              </button>
            )}
          </div>
        </div>

        {/* Campaign Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Total Tickets Issued
            </span>
            <span className="text-xl font-black text-foreground">
              {raffle._count?.tickets || raffle.totalTickets}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Distinct Participants
            </span>
            <span className="text-xl font-black text-foreground">
              {raffle._count?.entries || 0} Customers
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Prize Tiers / Winner Slots
            </span>
            <span className="text-xl font-black text-amber-700">
              {raffle.prizes.length} Tiers / {totalPrizeSlots} Slots
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Winners Selected
            </span>
            <span className="text-xl font-black text-emerald-600">
              {raffle.winners.length} / {totalPrizeSlots}
            </span>
          </div>
        </div>
      </div>

      {/* ── Draw Engine Command Console ── */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <Dices className="h-4 w-4" />
              Cryptographic Draw Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-black">
              Conduct Winner Draw
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Uses cryptographically secure random selection to choose winning tickets for all {raffle.prizes.length} configured prize tiers. Transparent and fully auditable.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={allowMultipleWins}
                onChange={(e) => setAllowMultipleWins(e.target.checked)}
                className="w-4 h-4 rounded text-primary accent-primary"
              />
              <span>Allow single user to win multiple tiers</span>
            </label>

            <button
              type="button"
              onClick={handleExecuteDraw}
              disabled={drawLoading || raffle.tickets.length === 0}
              className="flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/25 disabled:opacity-40 transition-all hover:scale-[1.01]"
            >
              {drawLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Selecting Winners...</span>
                </>
              ) : (
                <>
                  <Dices className="h-5 w-5" />
                  <span>
                    {raffle.winners.length > 0 ? "Re-execute Random Draw" : "Execute Winner Draw Now"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {raffle.drawSeed && (
          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2 font-mono">
            <span>Audit Seed: {raffle.drawSeed}</span>
            <span className="text-emerald-400 font-sans font-bold flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" /> Cryptographic Verification Active
            </span>
          </div>
        )}
      </div>

      {/* ── Console Navigation Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("WINNERS")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "WINNERS"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>Selected Winners ({raffle.winners.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("FULFILMENT")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "FULFILMENT"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          <Truck className="h-4 w-4" />
          <span>Prize Fulfilment & Shipping</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TICKETS")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "TICKETS"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          <Ticket className="h-4 w-4" />
          <span>Participants & Tickets ({raffle._count?.tickets || raffle.totalTickets})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("AUDIT")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "AUDIT"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Audit History</span>
        </button>
      </div>

      {/* ── TAB 1: SELECTED WINNERS & VERIFICATION ── */}
      {activeTab === "WINNERS" && (
        <div className="space-y-4">
          {/* Approval Banner */}
          {raffle.winners.length > 0 && !raffle.winnersAnnounced && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-amber-950 text-sm sm:text-base">
                  Winners Ready for Approval & Announcement
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Review the selected winners below. Once approved, winners will be notified and can immediately claim free shipping or purchase discounted prizes.
                </p>
              </div>

              <button
                type="button"
                onClick={handleApproveWinners}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-500 shadow-md transition-all self-start sm:self-auto shrink-0"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Approve & Announce Winners</span>
              </button>
            </div>
          )}

          {raffle.winners.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-border">
              <Dices className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-black text-foreground">No Winners Selected Yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Use the Cryptographic Draw Engine above when you are ready to conduct the random draw for this campaign.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {raffle.winners.map((winner: any) => {
                const isClaimed = winner.status === "CLAIMED";
                const isFree = winner.prizeType === "FREE_PRODUCT";

                return (
                  <div
                    key={winner.id}
                    className="bg-white rounded-3xl p-6 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <span className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                        #{winner.rank}
                      </span>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-base text-foreground">
                            {winner.prize.name}
                          </span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {isFree ? "Free Gift" : `$${winner.winningPrice} Purchase`}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            Winner: <strong className="text-foreground">{winner.user.name || "Customer"}</strong> ({winner.user.email})
                          </span>
                          <span>•</span>
                          <span>
                            Ticket: <strong className="font-mono text-slate-800">{winner.ticket.ticketNumber}</strong>
                          </span>
                        </div>

                        {winner.notes && (
                          <p className="text-[11px] text-amber-700 italic mt-1">{winner.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start md:self-auto pt-3 md:pt-0 border-t md:border-t-0 border-border">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          isClaimed
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isClaimed ? "Claimed / Address Given" : "Pending Customer Claim"}
                      </span>

                      <button
                        type="button"
                        onClick={() => setRedrawWinnerTarget(winner)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
                        title="Replace winner if verification fails"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Redraw</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: PRIZE FULFILMENT & SHIPPING TRACKING ── */}
      {activeTab === "FULFILMENT" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-border shadow-xs">
            <h2 className="text-lg font-black text-foreground mb-1">
              Winner Prize Deliveries & Fulfilment
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              View customer submitted shipping addresses, assign courier tracking numbers, and update delivery milestones.
            </p>

            {raffle.winners.filter((w: any) => w.status === "CLAIMED").length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                No winners have submitted their claim or shipping address yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {raffle.winners
                  .filter((w: any) => w.status === "CLAIMED")
                  .map((winner: any) => {
                    const addr = winner.shippingAddress;
                    return (
                      <div
                        key={winner.id}
                        className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              {winner.prize.name} (Rank #{winner.rank})
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100">
                              {winner.deliveryStatus}
                            </span>
                          </div>

                          {addr ? (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>
                                {addr.name} ({addr.phone}) • {addr.line1}, {addr.suburb} {addr.state} {addr.postcode}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Address not provided yet
                            </span>
                          )}

                          {winner.trackingNumber && (
                            <div className="text-xs font-mono text-slate-700">
                              Carrier: {winner.carrier || "Standard"} • Tracking: {winner.trackingNumber}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setEditingFulfilment({
                              winnerId: winner.id,
                              carrier: winner.carrier || "Australia Post",
                              trackingNumber: winner.trackingNumber || "",
                              deliveryStatus: winner.deliveryStatus || "PROCESSING",
                              notes: winner.notes || "",
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 transition-all self-start md:self-auto shrink-0 shadow-xs"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          <span>Update Shipping</span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: PARTICIPANTS & TICKETS ── */}
      {activeTab === "TICKETS" && (
        <div className="bg-white rounded-3xl p-6 border border-border shadow-xs">
          <h2 className="text-lg font-black text-foreground mb-4">
            Participants & Tickets Inspector
          </h2>

          <div className="divide-y divide-border">
            {raffle.tickets.slice(0, 100).map((ticket: any) => (
              <div
                key={ticket.id}
                className="py-2.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {ticket.ticketNumber}
                  </span>
                  <span className="text-muted-foreground">
                    {ticket.user.name || ticket.user.email}
                  </span>
                </div>
                <span className="text-muted-foreground text-[11px]">
                  {new Date(ticket.createdAt).toLocaleDateString("en-AU")}
                </span>
              </div>
            ))}
          </div>

          {raffle.tickets.length > 100 && (
            <p className="text-xs text-muted-foreground text-center pt-4">
              Showing first 100 tickets of {raffle.tickets.length} total.
            </p>
          )}
        </div>
      )}

      {/* ── TAB 4: AUDIT LOGS ── */}
      {activeTab === "AUDIT" && (
        <div className="bg-white rounded-3xl p-6 border border-border shadow-xs">
          <h2 className="text-lg font-black text-foreground mb-4">
            Campaign Audit Trail
          </h2>

          <div className="space-y-3">
            {raffle.auditLogs.map((log: any) => (
              <div
                key={log.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block font-mono">
                    {log.action}
                  </span>
                  {log.details && (
                    <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap font-mono">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
                <span className="text-muted-foreground text-[10px] shrink-0 font-mono">
                  {new Date(log.createdAt).toLocaleString("en-AU")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Redraw Modal ── */}
      {redrawWinnerTarget && (
        <Dialog open={!!redrawWinnerTarget} onOpenChange={() => setRedrawWinnerTarget(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">
                Replace / Redraw Winner
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Disqualify current winner ({redrawWinnerTarget.user.name || redrawWinnerTarget.user.email}) and randomly select another eligible ticket for {redrawWinnerTarget.prize.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Reason for Redraw / Disqualification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={redrawReason}
                  onChange={(e) => setRedrawReason(e.target.value)}
                  placeholder="e.g. Unreachable after deadline / Failed geographic eligibility verification..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRedrawWinnerTarget(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRedraw}
                  disabled={actionLoading || !redrawReason.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirm Redraw
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Fulfilment Modal ── */}
      {editingFulfilment && (
        <Dialog open={!!editingFulfilment} onOpenChange={() => setEditingFulfilment(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">
                Update Prize Shipping & Tracking
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Assign tracking details and progress the fulfilment status.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveFulfilment} className="space-y-3 mt-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                  Delivery Status *
                </label>
                <select
                  value={editingFulfilment.deliveryStatus}
                  onChange={(e) =>
                    setEditingFulfilment({
                      ...editingFulfilment,
                      deliveryStatus: e.target.value as any,
                    })
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 font-bold focus:outline-hidden"
                >
                  <option value="PROCESSING">PROCESSING (Packing in warehouse)</option>
                  <option value="SHIPPED">SHIPPED (In transit with courier)</option>
                  <option value="DELIVERED">DELIVERED (Successfully delivered)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                  Courier / Carrier
                </label>
                <input
                  type="text"
                  value={editingFulfilment.carrier}
                  onChange={(e) =>
                    setEditingFulfilment({ ...editingFulfilment, carrier: e.target.value })
                  }
                  placeholder="e.g. Australia Post, CouriersPlease"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={editingFulfilment.trackingNumber}
                  onChange={(e) =>
                    setEditingFulfilment({ ...editingFulfilment, trackingNumber: e.target.value })
                  }
                  placeholder="e.g. AP12345678AU"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={editingFulfilment.notes}
                  onChange={(e) =>
                    setEditingFulfilment({ ...editingFulfilment, notes: e.target.value })
                  }
                  placeholder="Notes about packaging, delivery confirmation..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFulfilment(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 disabled:opacity-50"
                >
                  Save Tracking
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
