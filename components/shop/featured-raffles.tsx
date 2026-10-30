import Link from "next/link";
import { getHomepageRaffles } from "@/lib/actions/raffle";
import { RaffleCard } from "@/components/raffle/raffle-card";
import { ArrowRight, Sparkles } from "lucide-react";

export async function FeaturedRaffles() {
  const { raffles } = await getHomepageRaffles();

  if (!raffles || raffles.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-14 sm:py-20 border-b border-border/60">
      <div className="container mx-auto px-5 md:px-6 xl:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 md:mb-12">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              CHS Community Giveaways
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Lucky Raffles &amp; Wins
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
              Enter for free to win handcrafted platform beds, luxury recliners, and designer decor. Multiple lucky winners selected each draw!
            </p>
          </div>

          <Link
            href="/raffles"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-6 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-secondary hover:text-primary self-start sm:self-auto shrink-0"
          >
            <span>Explore all raffles</span>
            <ArrowRight className="h-4 w-4" />
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


