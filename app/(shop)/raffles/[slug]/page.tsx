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
  ChevronLeft,
  Sparkles,
  Users,
  Truck,
  RotateCcw,
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
    <div className="min-h-screen bg-white pb-20">
      {/* ── Breadcrumb Bar (Site Theme) ── */}
      <div className="border-b border-border bg-[#fdfbf9]">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            <Link href="/raffles" className="hover:text-primary transition-colors">
              Raffles & Giveaways
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold truncate max-w-xs">{raffle.title}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            100% Free Doorstep Delivery
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 max-w-6xl mt-4 sm:mt-6">
        {/* Navigation back pill on mobile/desktop */}
        <div className="mb-3.5 flex items-center justify-between">
          <Link
            href="/raffles"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors py-1.5 px-3.5 rounded-full bg-secondary/70 hover:bg-secondary border border-border/70"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Back to All Raffles</span>
          </Link>

          <Link
            href="/account/raffles"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Ticket className="h-3.5 w-3.5" />
            <span>My Tickets &amp; Wins</span>
          </Link>
        </div>

        {/* ── Top Hero Card (Light Warm Site Theme) ── */}
        <div className="rounded-2xl overflow-hidden border border-border/80 bg-white shadow-xs">
          {/* Banner Image Container */}
          <div className="relative aspect-[16/9] sm:aspect-[21/9] min-h-[220px] sm:min-h-[300px] w-full bg-secondary">
            <Image
              src={mainImage}
              alt={raffle.title}
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

            {/* Badges Overlay (Fully Responsive Wrap) */}
            <div className="absolute top-3 left-3 sm:top-5 sm:left-5 right-3 sm:right-5 flex flex-wrap gap-1.5 sm:gap-2 items-center z-10 pointer-events-none">
              {isFree ? (
                <span className="inline-flex items-center gap-1.5 bg-emerald-700 text-white text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-xs whitespace-nowrap pointer-events-auto">
                  <Gift className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>100% Free Giveaway</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-xs whitespace-nowrap pointer-events-auto">
                  <Ticket className="h-3.5 w-3.5" />
                  <span>${raffle.entryPrice} Entry</span>
                </span>
              )}

              {isMembersOnly && (
                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-xs whitespace-nowrap pointer-events-auto">
                  <Crown className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-amber-900" />
                  <span>VIP Members Only</span>
                </span>
              )}

              {raffle.isFeatured && (
                <span className="inline-flex items-center gap-1.5 bg-primary text-white text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-xs whitespace-nowrap pointer-events-auto">
                  <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>Featured Draw</span>
                </span>
              )}
            </div>

            {/* Title & Subtitle Overlay on Banner */}
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-10 text-white">
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight max-w-3xl">
                {raffle.title}
              </h1>
              {raffle.shortDescription && (
                <p className="text-xs sm:text-sm text-white/90 font-medium mt-1.5 max-w-2xl leading-relaxed">
                  {raffle.shortDescription}
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats Strip in Site Theme */}
          <div className="bg-[#f7f3ed] border-t border-border/80 px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-foreground">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-border/80 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                  Prize Valuation
                </span>
                <span className="text-base font-bold text-foreground">
                  ${totalPrizeValue.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-border/80 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                  Winners Selected
                </span>
                <span className="text-base font-bold text-foreground">
                  {totalWinnersCount} Winners
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-border/80 flex items-center justify-center text-emerald-700 shrink-0 shadow-xs">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                  Tickets Claimed
                </span>
                <span className="text-base font-bold text-foreground">
                  {raffle.totalTickets} {raffle.totalMaxEntries ? `/ ${raffle.totalMaxEntries}` : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-border/80 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                  Official Draw Date
                </span>
                <span className="text-xs font-bold text-foreground">
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
          {/* Left Column: Prizes, Overview, Rules & Winners (2 cols) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Draw Completed & Winners Announcement Board */}
            {isCompleted && raffle.winners.length > 0 && (
              <div className="bg-[#fcfbf9] rounded-2xl p-6 sm:p-8 border border-border shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center font-bold">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      VERIFIED RESULTS
                    </span>
                    <h2 className="text-xl font-semibold text-foreground mt-0.5">
                      Winning Draw Results
                    </h2>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {raffle.winners.map((winner) => (
                    <div
                      key={winner.id}
                      className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-secondary text-foreground border border-border font-bold text-xs flex items-center justify-center shrink-0">
                          #{winner.rank}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {winner.prize.name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>Winner: <strong className="text-foreground">{winner.user.name || "Verified Customer"}</strong></span>
                            <span>•</span>
                            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-border text-foreground">
                              {winner.ticket.ticketNumber}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          {winner.status === "CLAIMED" ? "Claimed" : "Drawn & Confirmed"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {raffle.drawSeed && (
                  <div className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between font-mono">
                    <span>Audit Seed: {raffle.drawSeed.slice(0, 16)}...</span>
                    <span className="text-emerald-700 font-sans font-semibold flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Cryptographically Verified
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Multi-Tier Prize Breakdown */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-border shadow-xs">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Prize Pool Breakdown
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {raffle.prizes.length} prize tiers available for {totalWinnersCount} lucky participants
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Gift className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-4">
                {raffle.prizes.map((prize) => {
                  const isFreePrize = prize.prizeType === "FREE_PRODUCT";
                  return (
                    <div
                      key={prize.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#fcfbf9] border border-border/80"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-secondary text-foreground border border-border font-bold text-xs flex items-center justify-center shrink-0">
                          {prize.rank}
                        </span>

                        {prize.images && prize.images[0] && (
                          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-white shrink-0 border border-border">
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
                            <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
                              {prize.name}
                            </h3>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary text-foreground shrink-0 border border-border">
                              {prize.quantity} winner{prize.quantity > 1 ? "s" : ""}
                            </span>
                          </div>

                          {prize.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                              {prize.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Prize Value / Rate Badge */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Winner Rate
                          </span>
                          {isFreePrize ? (
                            <span className="text-emerald-700 font-bold text-base">
                              100% FREE
                            </span>
                          ) : (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-primary font-bold text-base">
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
                          <span className="text-[11px] font-medium text-muted-foreground bg-white px-2 py-0.5 rounded border border-border mt-1">
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
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-border shadow-xs">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Campaign Overview
              </h2>
              <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {raffle.description}
              </div>
            </div>

            {/* Official Rules & Transparency */}
            <div className="bg-[#f7f3ed] rounded-2xl p-6 sm:p-8 border border-border shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">
                  Official Rules & Eligibility
                </h2>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  • <strong>Participation Limits:</strong> Up to {raffle.maxEntriesPerUser} entry ticket
                  {raffle.maxEntriesPerUser > 1 ? "s" : ""} per customer account.
                </p>
                <p>
                  • <strong>Eligibility:</strong>{" "}
                  {isMembersOnly
                    ? "Exclusive to active Complete Home Solution VIP Members."
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
                  • <strong>Free Prize Delivery:</strong> Winners of free prizes will receive doorstep shipping across Australia with no courier charges.
                </p>
                <p>
                  • <strong>Paid Product Winners:</strong> Winners of discounted products have 14 days to complete their order at the winning rate.
                </p>
                {raffle.terms && (
                  <div className="mt-4 pt-3 border-t border-border">
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
            <div className="bg-white rounded-2xl p-5 border border-border shadow-xs">
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

            {/* Site Assurance Badges */}
            <div className="divide-y divide-border/70 rounded-2xl border border-border bg-[#faf8f5] px-4 sm:px-5">
              <div className="flex items-center gap-3.5 py-3 text-xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-xs border border-border">
                  <Truck className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Free Australian Delivery</span>
                  <span className="mt-0.5 block text-muted-foreground">Complimentary dispatch on won prizes</span>
                </span>
              </div>

              <div className="flex items-center gap-3.5 py-3 text-xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-xs border border-border">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Verifiable Random Selection</span>
                  <span className="mt-0.5 block text-muted-foreground">Transparent cryptographic audit seed</span>
                </span>
              </div>

              <div className="flex items-center gap-3.5 py-3 text-xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-xs border border-border">
                  <RotateCcw className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Australian Warranty</span>
                  <span className="mt-0.5 block text-muted-foreground">Standard CHS structural coverage applies</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
