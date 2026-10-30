import Link from "next/link";
import { getHomepageRaffles } from "@/lib/actions/raffle";
import { RaffleCard } from "@/components/raffle/raffle-card";
import { Sparkles, Trophy, ArrowRight, Gift } from "lucide-react";

export async function FeaturedRaffles() {
  const { raffles } = await getHomepageRaffles();

  if (!raffles || raffles.length === 0) {
    return null;
  }

  return (
    <section className="py-14 sm:py-20 bg-gradient-to-b from-white via-slate-50/60 to-white border-y border-border/60">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-black uppercase tracking-wider mb-2 border border-amber-500/20">
              <Sparkles className="h-3.5 w-3.5" />
              Free Community Giveaways
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
              Lucky Raffles & Mega Wins
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
              Enter for free to win handcrafted platform beds, luxury recliners, and designer decor. Multiple lucky winners selected each draw!
            </p>
          </div>

          <Link
            href="/raffles"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-primary text-white hover:bg-primary/95 shadow-md hover:shadow-primary/20 transition-all self-start sm:self-auto group"
          >
            <span>Explore All Raffles</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Raffles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {raffles.map((raffle) => (
            <RaffleCard key={raffle.id} raffle={raffle as any} />
          ))}
        </div>
      </div>
    </section>
  );
}

