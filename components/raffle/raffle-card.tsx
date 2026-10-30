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
    <div className="group relative flex flex-col bg-white rounded-3xl border border-border/80 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* ── Top Image Container ── */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <Image
          src={mainImage}
          alt={raffle.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center z-10">
          {isFree ? (
            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-md uppercase tracking-wider">
              <Gift className="h-3 w-3" />
              100% Free Entry
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-slate-900 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-md uppercase tracking-wider">
              <Ticket className="h-3 w-3" />
              ${raffle.entryPrice}
            </span>
          )}

          {isMembersOnly && (
            <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 text-[11px] font-black px-2.5 py-1 rounded-full shadow-md uppercase tracking-wider">
              <Crown className="h-3 w-3 fill-slate-950" />
              VIP Only
            </span>
          )}

          {raffle.isFeatured && (
            <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-md uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              Featured
            </span>
          )}
        </div>

        {/* Status / Value Tag */}
        <div className="absolute top-3 right-3 z-10">
          {totalPrizeValue > 0 && (
            <div className="bg-white/95 backdrop-blur-xs text-slate-900 px-3 py-1 rounded-full text-xs font-black shadow-md border border-white/40">
              Total Value: <span className="text-primary">${totalPrizeValue.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Bottom overlay with countdown or winner badge */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white z-10">
          {isActive ? (
            <RaffleCountdown targetDate={raffle.endDate} size="sm" />
          ) : isUpcoming ? (
            <div className="inline-flex items-center gap-1 text-xs font-bold text-sky-200 bg-sky-950/80 px-2.5 py-1 rounded-full backdrop-blur-xs">
              Starts on {new Date(raffle.startDate).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-200 bg-emerald-950/80 px-2.5 py-1 rounded-full backdrop-blur-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Draw Completed
            </div>
          )}

          <div className="inline-flex items-center gap-1 text-xs font-bold bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
            <Trophy className="h-3 w-3 text-amber-400" />
            <span>{totalWinnersCount} Winner{totalWinnersCount > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* ── Content Container ── */}
      <div className="flex flex-col flex-1 p-5">
        <Link href={`/raffles/${raffle.slug}`}>
          <h3 className="font-extrabold text-lg sm:text-xl text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {raffle.title}
          </h3>
        </Link>

        {raffle.shortDescription && (
          <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 line-clamp-2">
            {raffle.shortDescription}
          </p>
        )}

        {/* Prize Tiers Preview */}
        <div className="mt-4 space-y-1.5 bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Multi-Tier Prize Pool
          </p>
          <div className="space-y-1">
            {raffle.prizes.slice(0, 3).map((prize) => (
              <div key={prize.id} className="flex items-center justify-between text-xs">
                <span className="font-medium truncate max-w-[70%] text-foreground flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black shrink-0">
                    {prize.rank}
                  </span>
                  <span className="truncate">{prize.name}</span>
                </span>
                <span className="shrink-0 font-bold text-[11px] text-primary">
                  {prize.prizeType === "FREE_PRODUCT" ? (
                    <span className="text-emerald-600 font-extrabold">FREE</span>
                  ) : (
                    <span>${prize.price}</span>
                  )}
                </span>
              </div>
            ))}
            {raffle.prizes.length > 3 && (
              <p className="text-[10px] text-muted-foreground text-right italic">
                + {raffle.prizes.length - 3} more prize tier(s)
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar & Ticket Stats */}
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
            <span>{raffle.totalTickets} ticket{raffle.totalTickets !== 1 ? "s" : ""} claimed</span>
            {raffle.totalMaxEntries && (
              <span>{Math.max(0, raffle.totalMaxEntries - raffle.totalTickets)} remaining</span>
            )}
          </div>

          {progressPercent !== null && (
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-5 pt-3">
          <Link
            href={`/raffles/${raffle.slug}`}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-primary text-white hover:bg-primary/95 shadow-md hover:shadow-lg transition-all group-hover:scale-[1.01]"
          >
            {isActive ? (
              <>
                <span>Enter Giveaway</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            ) : isCompleted ? (
              <>
                <span>View Winners</span>
                <Trophy className="h-4 w-4 text-amber-300" />
              </>
            ) : (
              <>
                <span>View Campaign</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

