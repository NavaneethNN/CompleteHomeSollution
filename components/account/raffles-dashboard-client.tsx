"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Trophy,
  Gift,
  Ticket,
  Truck,
  CheckCircle2,
  Clock,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { RaffleClaimModal } from "@/components/raffle/raffle-claim-modal";
import { RafflePurchaseModal } from "@/components/raffle/raffle-purchase-modal";
import { toast } from "sonner";

interface DashboardClientProps {
  data: {
    wins: any[];
    allTickets: any[];
    activeParticipations: any[];
    pendingDrawParticipations: any[];
    completedParticipations: any[];
    savedAddresses: any[];
  };
}

export function CustomerRafflesClient({ data }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"WINS" | "ACTIVE" | "TICKETS" | "PAST">("WINS");
  const [claimWinner, setClaimWinner] = useState<any | null>(null);
  const [purchaseWinner, setPurchaseWinner] = useState<any | null>(null);
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);

  const { wins, allTickets, activeParticipations, pendingDrawParticipations, completedParticipations, savedAddresses } =
    data;

  const handleCopyTicket = (ticketNumber: string, id: string) => {
    navigator.clipboard.writeText(ticketNumber);
    setCopiedTicketId(id);
    toast.success("Ticket number copied!");
    setTimeout(() => setCopiedTicketId(null), 2000);
  };

  const pendingWinsCount = wins.filter((w) => w.status === "PENDING_CLAIM").length;

  return (
    <div className="space-y-6">
      {/* ── Top Header & Stats ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider mb-2">
              <Ticket className="h-3.5 w-3.5" />
              Customer Raffle Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              My Raffles & Wins
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Track your giveaway entries, unique ticket codes, and claim your winning gifts.
            </p>
          </div>

          <Link
            href="/raffles"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/95 shadow-md transition-all self-start sm:self-auto"
          >
            <Gift className="h-4 w-4" />
            <span>Explore Active Raffles</span>
          </Link>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-border">
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 text-center">
            <span className="block text-2xl font-black text-amber-700">{wins.length}</span>
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              Prizes Won
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/10 text-center">
            <span className="block text-2xl font-black text-primary">{activeParticipations.length}</span>
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
              Active Raffles
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <span className="block text-2xl font-black text-slate-800">{allTickets.length}</span>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Tickets
            </span>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("WINS")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "WINS"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>My Wins</span>
          {pendingWinsCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-slate-950 text-amber-400 text-[10px] font-black flex items-center justify-center animate-pulse">
              {pendingWinsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ACTIVE")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "ACTIVE"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          <Ticket className="h-4 w-4" />
          <span>Active Raffles ({activeParticipations.length})</span>
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
          <span>All Tickets ({allTickets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PAST")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "PAST"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Past Draws ({completedParticipations.length})</span>
        </button>
      </div>

      {/* ── TAB 1: MY WINS & CLAIMS ── */}
      {activeTab === "WINS" && (
        <div className="space-y-4">
          {wins.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-border">
              <Trophy className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-black text-foreground">No Prizes Won Yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Keep participating in our free promotional raffles! When your ticket is drawn, your winning rewards will appear right here.
              </p>
              <Link
                href="/raffles"
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/95 transition-all"
              >
                <span>Enter Live Giveaways</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {wins.map((win) => {
                const isClaimed = win.status === "CLAIMED";
                const isFree = win.prizeType === "FREE_PRODUCT";
                const winPrice = win.winningPrice || win.prize?.price || 0;
                const prizeImage =
                  win.prize?.images?.[0] ||
                  win.prize?.product?.images?.[0] ||
                  "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80";

                return (
                  <div
                    key={win.id}
                    className={`bg-white rounded-3xl p-6 border transition-all ${
                      !isClaimed
                        ? "border-amber-400 ring-2 ring-amber-400/20 shadow-lg"
                        : "border-border shadow-xs"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          <Image
                            src={prizeImage}
                            alt={win.prize.name}
                            fill
                            className="object-cover"
                          />
                          <span className="absolute top-1 left-1 w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs">
                            #{win.rank}
                          </span>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              🎉 Winner Rank #{win.rank}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Ticket: <strong className="font-mono text-slate-800">{win.ticket.ticketNumber}</strong>
                            </span>
                          </div>

                          <h3 className="font-black text-lg text-foreground mt-1">
                            {win.prize.name}
                          </h3>

                          <p className="text-xs text-muted-foreground">
                            Raffle:{" "}
                            <Link
                              href={`/raffles/${win.raffle.slug}`}
                              className="text-primary hover:underline font-semibold"
                            >
                              {win.raffle.title}
                            </Link>
                          </p>

                          <div className="mt-2 flex items-center gap-3 text-xs">
                            <span className="font-bold text-slate-600">
                              Prize Type:{" "}
                              {isFree ? (
                                <span className="text-emerald-600 font-extrabold">100% FREE GIFT</span>
                              ) : (
                                <span className="text-primary font-extrabold">
                                  Purchase at ${winPrice} (Valued at ${win.prize.value})
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action / Delivery status */}
                      <div className="flex flex-col sm:items-end justify-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-border">
                        {!isClaimed ? (
                          <>
                            {isFree ? (
                              <button
                                type="button"
                                onClick={() => setClaimWinner(win)}
                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-lg transition-all animate-pulse"
                              >
                                <Gift className="h-4 w-4" />
                                <span>Claim Free Gift & Add Address</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPurchaseWinner(win)}
                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black text-xs sm:text-sm bg-primary text-white hover:bg-primary/95 shadow-md hover:shadow-lg transition-all animate-pulse"
                              >
                                <ShoppingBag className="h-4 w-4" />
                                <span>Purchase Prize for ${winPrice}</span>
                              </button>
                            )}
                            <span className="text-[11px] text-amber-700 font-bold">
                              Action required to dispatch your prize
                            </span>
                          </>
                        ) : (
                          <div className="text-left sm:text-right space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {win.deliveryStatus === "DELIVERED"
                                ? "Delivered"
                                : win.deliveryStatus === "SHIPPED"
                                ? "Dispatched / Shipped"
                                : "Claimed & Preparing"}
                            </span>

                            {win.trackingNumber && (
                              <div className="text-xs text-muted-foreground font-mono">
                                <span>Tracking: </span>
                                <strong className="text-foreground">{win.trackingNumber}</strong>
                                {win.carrier && <span> ({win.carrier})</span>}
                              </div>
                            )}

                            {win.orderId && (
                              <div>
                                <Link
                                  href={`/account/orders/${win.orderId}`}
                                  className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  View Order #{win.orderId.slice(-6)}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            )}

                            {win.shippingAddress && (
                              <p className="text-[11px] text-muted-foreground">
                                Delivering to: {win.shippingAddress.suburb}, {win.shippingAddress.state}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ACTIVE PARTICIPATIONS ── */}
      {activeTab === "ACTIVE" && (
        <div className="space-y-4">
          {activeParticipations.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-border">
              <Ticket className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-black text-foreground">No Active Raffles</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                You haven&apos;t joined any active raffles yet. Browse our live draws and grab your free tickets!
              </p>
              <Link
                href="/raffles"
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold"
              >
                Browse Raffles
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeParticipations.map(({ raffle, tickets }) => (
                <div
                  key={raffle.id}
                  className="bg-white rounded-3xl p-6 border border-border shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {raffle.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Draw: {new Date(raffle.drawDate).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <Link href={`/raffles/${raffle.slug}`}>
                      <h3 className="font-black text-base text-foreground hover:text-primary transition-colors">
                        {raffle.title}
                      </h3>
                    </Link>

                    <div className="mt-3">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Your Ticket Numbers ({tickets.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {tickets.map((t: any) => (
                          <span
                            key={t.id}
                            className="font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            {t.ticketNumber}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-semibold">
                      {raffle.prizes.length} prize tier{raffle.prizes.length > 1 ? "s" : ""}
                    </span>
                    <Link
                      href={`/raffles/${raffle.slug}`}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      View Campaign Details <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: ALL TICKETS ── */}
      {activeTab === "TICKETS" && (
        <div className="bg-white rounded-3xl p-6 border border-border shadow-xs">
          <h2 className="text-lg font-black text-foreground mb-4">
            All Issued Raffle Tickets ({allTickets.length})
          </h2>

          {allTickets.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No tickets generated yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {allTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {ticket.ticketNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyTicket(ticket.ticketNumber, ticket.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy ticket"
                    >
                      {copiedTicketId === ticket.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <span className="text-muted-foreground">
                      {ticket.raffle.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {ticket.winner ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                        🏆 Winner (#{ticket.winner.rank})
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">
                        {ticket.raffle.status}
                      </span>
                    )}
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(ticket.createdAt).toLocaleDateString("en-AU")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: PAST DRAWS ── */}
      {activeTab === "PAST" && (
        <div className="space-y-4">
          {completedParticipations.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-border">
              <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-black text-foreground">No Completed Draws Yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Once raffles you participated in conclude their winner draws, they will be archived here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedParticipations.map(({ raffle, tickets }) => (
                <div
                  key={raffle.id}
                  className="bg-white rounded-3xl p-5 border border-border flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{raffle.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      You held {tickets.length} ticket{tickets.length > 1 ? "s" : ""} in this draw
                    </p>
                  </div>
                  <Link
                    href={`/raffles/${raffle.slug}`}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View Results <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Claim Free Prize Modal ── */}
      {claimWinner && (
        <RaffleClaimModal
          winner={claimWinner}
          savedAddresses={savedAddresses}
          isOpen={!!claimWinner}
          onClose={() => setClaimWinner(null)}
        />
      )}

      {/* ── Purchase Paid Prize Modal ── */}
      {purchaseWinner && (
        <RafflePurchaseModal
          winner={purchaseWinner}
          savedAddresses={savedAddresses}
          isOpen={!!purchaseWinner}
          onClose={() => setPurchaseWinner(null)}
        />
      )}
    </div>
  );
}
