import { getRaffleDetails } from "@/lib/actions/raffle";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Trophy,
  Gift,
  Ticket,
  Crown,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Users,
  Clock,
  Tag,
  AlertCircle,
} from "lucide-react";
import { RaffleCountdown } from "@/components/raffle/raffle-countdown";
import { RaffleEntryWidget } from "@/components/raffle/raffle-entry-widget";

interface RaffleDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: RaffleDetailPageProps) {
  const { slug } = await params;
  const { raffle } = await getRaffleDetails(slug);
  if (!raffle) return { title: "Raffle Not Found" };

  return {
    title: `${raffle.title} | Complete Home Sollution`,
    description: raffle.shortDescription || raffle.description.slice(0, 160),
  };
}

export default async function RaffleDetailPage({ params }: RaffleDetailPageProps) {
  const { slug } = await params;
  const { raffle, userParticipation, isLoggedIn, error } = await getRaffleDetails(slug);

  if (!raffle || error) {
    notFound();
  }

  const isMembersOnly = raffle.visibility === "MEMBERS_ONLY";
  const isFree = raffle.entryPrice === 0;
  const totalPrizeValue = raffle.prizes.reduce((sum, p) => sum + p.value * p.quantity, 0);
  const totalWinnersCount = raffle.prizes.reduce((sum, p) => sum + p.quantity, 0);

  const isActive = raffle.status === "ACTIVE";
  const isCompleted = ["DRAW_COMPLETED", "WINNER_VERIFICATION", "COMPLETED"].includes(raffle.status);

  const mainImage =
    raffle.bannerImage ||
    raffle.images?.[0] ||
    raffle.prizes[0]?.images?.[0] ||
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80";

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      {/* ── Breadcrumb Bar ── */}
      <div className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/raffles" className="hover:text-primary transition-colors">
            Raffles & Giveaways
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-semibold truncate max-w-xs">{raffle.title}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-6">
        {/* ── Top Hero Card ── */}
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl">
          {/* Background Image Banner */}
          <div className="relative aspect-[21/9] min-h-[260px] sm:min-h-[340px] w-full">
            <Image
              src={mainImage}
              alt={raffle.title}
              fill
              priority
              className="object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />

            {/* Badges Overlay */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex flex-wrap gap-2 items-center z-10">
              {isFree ? (
                <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-black px-3.5 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
                  <Gift className="h-3.5 w-3.5" />
                  100% Free Giveaway
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-slate-800 text-white text-xs font-black px-3.5 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
                  <Ticket className="h-3.5 w-3.5" />
                  ${raffle.entryPrice} Entry
                </span>
              )}

              {isMembersOnly && (
                <span className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 text-xs font-black px-3.5 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
                  <Crown className="h-3.5 w-3.5 fill-slate-950" />
                  VIP Members Only
                </span>
              )}

              {raffle.isFeatured && (
                <span className="inline-flex items-center gap-1.5 bg-purple-600 text-white text-xs font-black px-3.5 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  Featured Draw
                </span>
              )}
            </div>

            {/* Bottom Header Details */}
            <div className="absolute bottom-6 left-6 right-6 z-10 text-white">
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight max-w-3xl">
                {raffle.title}
              </h1>
              {raffle.shortDescription && (
                <p className="text-sm sm:text-base text-slate-300 font-medium mt-2 max-w-2xl">
                  {raffle.shortDescription}
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats Strip */}
          <div className="bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Prize Valuation
                </span>
                <span className="text-base font-black text-amber-300">
                  ${totalPrizeValue.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Winners Selected
                </span>
                <span className="text-base font-black text-white">
                  {totalWinnersCount} Winners
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total Tickets
                </span>
                <span className="text-base font-black text-white">
                  {raffle.totalTickets} {raffle.totalMaxEntries ? `/ ${raffle.totalMaxEntries}` : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Official Draw Date
                </span>
                <span className="text-xs font-bold text-white">
                  {new Date(raffle.drawDate).toLocaleDateString("en-AU", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Two-Column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 items-start">
          {/* Left Column: Prizes, Details, Rules & Winners (2 cols) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Draw Completed & Winners Announcement Board */}
            {isCompleted && raffle.winners.length > 0 && (
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-md">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-200/50 px-2.5 py-0.5 rounded-full">
                      Verified Results
                    </span>
                    <h2 className="text-2xl font-black text-foreground mt-0.5">
                      Winning Draw Results
                    </h2>
                  </div>
                </div>

                <div className="divide-y divide-amber-200/40">
                  {raffle.winners.map((winner) => (
                    <div
                      key={winner.id}
                      className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                          #{winner.rank}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">
                            {winner.prize.name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>Winner: <strong className="text-foreground">{winner.user.name || "Verified Customer"}</strong></span>
                            <span>•</span>
                            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200 text-slate-700">
                              {winner.ticket.ticketNumber}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {winner.status === "CLAIMED" ? "Claimed" : "Drawn & Confirmed"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {raffle.drawSeed && (
                  <div className="mt-4 pt-3 border-t border-amber-200/40 text-[11px] text-muted-foreground flex items-center justify-between font-mono">
                    <span>Audit Seed: {raffle.drawSeed.slice(0, 16)}...</span>
                    <span className="text-amber-800 font-sans font-bold flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Cryptographically Verified
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Multi-Tier Prize Breakdown */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground">
                    Multi-Tier Prize Pool
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {raffle.prizes.length} prize tiers available for {totalWinnersCount} lucky participants
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Gift className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-4">
                {raffle.prizes.map((prize) => {
                  const isFreePrize = prize.prizeType === "FREE_PRODUCT";
                  return (
                    <div
                      key={prize.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                          {prize.rank}
                        </span>

                        {prize.images && prize.images[0] && (
                          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white shrink-0 border border-slate-200">
                            <Image
                              src={prize.images[0]}
                              alt={prize.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-sm sm:text-base text-foreground truncate">
                              {prize.name}
                            </h3>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 shrink-0">
                              {prize.quantity} winner{prize.quantity > 1 ? "s" : ""}
                            </span>
                          </div>

                          {prize.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {prize.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Prize Value / Rate Badge */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Winner Gets
                          </span>
                          {isFreePrize ? (
                            <span className="text-emerald-600 font-black text-base sm:text-lg">
                              100% FREE
                            </span>
                          ) : (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-primary font-black text-base sm:text-lg">
                                ${prize.price}
                              </span>
                              {prize.value > 0 && (
                                <span className="text-xs text-muted-foreground line-through">
                                  ${prize.value}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {prize.value > 0 && (
                          <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 mt-1">
                            Valued at ${prize.value}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Campaign Overview & Description */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs">
              <h2 className="text-xl sm:text-2xl font-black text-foreground mb-4">
                Campaign Overview
              </h2>
              <div className="prose prose-slate max-w-none text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {raffle.description}
              </div>
            </div>

            {/* Official Rules & Transparency */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-black text-foreground">
                  Official Rules & Eligibility
                </h2>
              </div>

              <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                <p>
                  • <strong>Participation Limits:</strong> Up to {raffle.maxEntriesPerUser} entry ticket
                  {raffle.maxEntriesPerUser > 1 ? "s" : ""} per customer account.
                </p>
                <p>
                  • <strong>Eligibility:</strong>{" "}
                  {isMembersOnly
                    ? "Exclusive to active Complete Home Sollution VIP Members."
                    : "Open to all registered customers residing in Australia (18+)."}
                </p>
                <p>
                  • <strong>Draw Selection:</strong> Random ticket selection using an auditable cryptographic seed conducted on{" "}
                  {new Date(raffle.drawDate).toLocaleDateString("en-AU", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}.
                </p>
                <p>
                  • <strong>Free Prize Delivery:</strong> Winners of free prizes will receive doorstep shipping with no shipping fees required.
                </p>
                <p>
                  • <strong>Paid Product Winners:</strong> Winners of discounted products have 14 days to claim and complete their order at the winning rate.
                </p>
                {raffle.terms && (
                  <div className="mt-4 pt-3 border-t border-border/80">
                    <strong className="text-foreground block mb-1">Additional Terms:</strong>
                    <p className="whitespace-pre-line">{raffle.terms}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Participation & Countdown Widget (1 col) */}
          <div className="space-y-6 sticky top-24">
            {/* Live Countdown Box */}
            <div className="bg-white rounded-3xl p-6 border border-border shadow-xs">
              <RaffleCountdown
                targetDate={raffle.endDate}
                label={isActive ? "Entries Close In" : "Draw Timeline"}
              />
            </div>

            {/* Entry Action Widget */}
            <RaffleEntryWidget
              raffle={raffle}
              userParticipation={userParticipation}
              isLoggedIn={isLoggedIn}
            />

            {/* Customer Guarantee Card */}
            <div className="p-5 rounded-3xl bg-slate-100/80 border border-slate-200/80 text-xs text-slate-700 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>CHS Verified Giveaway Promise</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                All prizes are 100% genuine and sourced directly from Complete Home Sollution catalogue. We never ask for bank passwords or extra verification fees.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

