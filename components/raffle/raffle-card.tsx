"use client";

import Link from "next/link";
import Image from "next/image";
import { Ticket, Trophy, Gift, Sparkles, Crown, ArrowRight, CheckCircle2 } from "lucide-react";
import { RaffleCountdown } from "./raffle-countdown";

interface RaffleCardProps {
  raffle: {
    id: string;
    title: string;
    slug: string;
    shortDescription?: string | null;
    bannerImage?: string | null;
    images?: string[];
    status: string;
    entryPrice: number;
    visibility: string;
    maxEntriesPerUser: number;
    totalMaxEntries?: number | null;
    totalTickets: number;
    totalParticipants: number;
    startDate: string | Date;
    endDate: string | Date;
    drawDate: string | Date;
    isFeatured?: boolean;
    prizes: Array<{
      id: string;
      rank: number;
      name: string;
      value: number;
      prizeType: string;
      price: number;
      quantity: number;
      images?: string[];
    }>;
    _count?: {
      tickets?: number;
    };
  };
}

export function RaffleCard({ raffle }: RaffleCardProps) {
  const isMembersOnly = raffle.visibility === "MEMBERS_ONLY";
  const isFree = raffle.entryPrice === 0;
  const mainImage =
    raffle.bannerImage ||
    raffle.images?.[0] ||
    raffle.prizes[0]?.images?.[0] ||
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80";

  const totalPrizeValue = raffle.prizes.reduce((sum, p) => sum + p.value * p.quantity, 0);
  const totalWinnersCount = raffle.prizes.reduce((sum, p) => sum + p.quantity, 0);

  const isActive = raffle.status === "ACTIVE";
  const isUpcoming = raffle.status === "UPCOMING";
  const isCompleted = ["DRAW_COMPLETED", "WINNER_VERIFICATION", "COMPLETED"].includes(raffle.status);

  const progressPercent = raffle.totalMaxEntries
    ? Math.min(100, Math.round((raffle.totalTickets / raffle.totalMaxEntries) * 100))
    : null;

  return (
    <div className="group h-full overflow-hidden rounded-2xl border border-border/80 bg-white transition-shadow hover:shadow-md flex flex-col">
      {/* ── Top Image Container ── */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        <Link href={`/raffles/${raffle.slug}`} className="absolute inset-0 block">
          <Image
            src={mainImage}
            alt={raffle.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center z-10">
          {isFree ? (
            <span className="inline-flex items-center gap-1 bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
              <Gift className="h-3 w-3" />
              100% Free Entry
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
              <Ticket className="h-3 w-3" />
              ${raffle.entryPrice}
            </span>
          )}

          {isMembersOnly && (
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
              <Crown className="h-3 w-3 fill-amber-900" />
              VIP Exclusive
            </span>
          )}

          {raffle.isFeatured && (
            <span className="inline-flex items-center gap-1 bg-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
              <Sparkles className="h-3 w-3" />
              Featured
            </span>
          )}
        </div>

        {/* Top Right Value Badge */}
        {totalPrizeValue > 0 && (
          <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-xs text-foreground px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs border border-border/60">
            Valued at <span className="text-primary font-bold">${totalPrizeValue.toLocaleString()}</span>
          </div>
        )}

        {/* Bottom Overlay Info */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-foreground z-10">
          {isActive ? (
            <RaffleCountdown targetDate={raffle.endDate} size="sm" />
          ) : isUpcoming ? (
            <div className="inline-flex items-center gap-1 text-xs font-medium text-foreground bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-xs border border-border/60">
              Opens {new Date(raffle.startDate).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Draw Completed
            </div>
          )}

          <div className="inline-flex items-center gap-1 text-xs font-medium text-foreground bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-xs border border-border/60">
            <Trophy className="h-3 w-3 text-amber-600" />
            <span>{totalWinnersCount} Winner{totalWinnersCount > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* ── Content Container ── */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex-1 flex flex-col">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {isMembersOnly ? "VIP Member Draw" : "Community Promotional Draw"}
          </span>

          <Link href={`/raffles/${raffle.slug}`}>
            <h3 className="mt-1 text-base sm:text-lg font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors">
              {raffle.title}
            </h3>
          </Link>

          {raffle.shortDescription && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {raffle.shortDescription}
            </p>
          )}

          {/* Prize Tiers Preview Box */}
          <div className="mt-3.5 rounded-xl bg-[#fcfbf9] border border-border/70 p-3 space-y-1.5">
            <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-muted-foreground">
              Prize Pool Breakdown
            </p>
            <div className="space-y-1">
              {raffle.prizes.slice(0, 3).map((prize) => (
                <div key={prize.id} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[72%] text-foreground flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-secondary text-foreground text-[10px] font-bold shrink-0 border border-border">
                      {prize.rank}
                    </span>
                    <span className="truncate font-medium">{prize.name}</span>
                  </span>
                  <span className="shrink-0 font-bold text-[11px]">
                    {prize.prizeType === "FREE_PRODUCT" ? (
                      <span className="text-emerald-700">100% FREE</span>
                    ) : (
                      <span className="text-primary">${prize.price}</span>
                    )}
                  </span>
                </div>
              ))}
              {raffle.prizes.length > 3 && (
                <p className="text-[10px] text-muted-foreground text-right italic pt-0.5">
                  + {raffle.prizes.length - 3} more prize tier(s)
                </p>
              )}
            </div>
          </div>

          {/* Progress / Tickets Indicator */}
          <div className="mt-4 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 font-medium">
              <span>{raffle.totalTickets} ticket{raffle.totalTickets !== 1 ? "s" : ""} claimed</span>
              {raffle.totalMaxEntries && (
                <span>{Math.max(0, raffle.totalMaxEntries - raffle.totalTickets)} remaining</span>
              )}
            </div>

            {progressPercent !== null && (
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-4">
          <Link
            href={`/raffles/${raffle.slug}`}
            className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 shadow-xs"
          >
            {isActive ? (
              <>
                <span>Enter Giveaway</span>
                <ArrowRight className="h-4 w-4" />
              </>
            ) : isCompleted ? (
              <>
                <span>View Results</span>
                <Trophy className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>View Campaign</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
