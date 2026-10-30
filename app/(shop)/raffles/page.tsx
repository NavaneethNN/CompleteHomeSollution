import { getPublicRaffles } from "@/lib/actions/raffle";
import { RaffleCard } from "@/components/raffle/raffle-card";
import { Gift, Trophy, ShieldCheck, Sparkles, HelpCircle, Ticket } from "lucide-react";
import Link from "next/link";

interface RafflesPageProps {
  searchParams: Promise<{
    tab?: string;
  }>;
}

export const metadata = {
  title: "Lucky Raffles & Free Home Giveaways | Complete Home Sollution",
  description:
    "Participate in our free promotional raffles to win luxury platform beds, designer recliners, and home essentials. Transparent draws with multiple winners!",
};

export default async function RafflesPage({ searchParams }: RafflesPageProps) {
  const { tab = "ALL" } = await searchParams;
  const statusFilter = tab === "ACTIVE" ? "ACTIVE" : tab === "UPCOMING" ? "UPCOMING" : tab === "COMPLETED" ? "COMPLETED" : "ALL";

  const { raffles, error } = await getPublicRaffles({
    status: statusFilter,
  });

  const totalPrizeValue = raffles.reduce(
    (sum, r) => sum + r.prizes.reduce((pSum, p) => pSum + p.value * p.quantity, 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-primary/80 text-white pt-14 pb-20 px-4 md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
        
        {/* Glow effects */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-black uppercase tracking-widest text-amber-300 shadow-lg">
            <Sparkles className="h-3.5 w-3.5" />
            Official CHS Community Giveaways
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            Win Premium Home Luxuries. <br />
            <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-white bg-clip-text text-transparent">
              100% Free Entry & Multi-Winner Draws.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Welcome to the Complete Home Sollution Raffle Arena. Enter free promotional draws for high-end furniture, designer accessories, or unlock deep winner-only purchase privileges.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto pt-6">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
              <span className="block text-2xl sm:text-3xl font-black text-amber-300">
                ${totalPrizeValue > 0 ? totalPrizeValue.toLocaleString() : "2,500+"}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Prize Pool Value
              </span>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
              <span className="block text-2xl sm:text-3xl font-black text-white">
                {raffles.filter((r) => r.status === "ACTIVE").length || 2}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Active Giveaways
              </span>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
              <span className="block text-2xl sm:text-3xl font-black text-emerald-400">
                100% Free
              </span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                No Purchase Required
              </span>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
              <span className="block text-2xl sm:text-3xl font-black text-sky-400">
                Verifiable
              </span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Cryptographic Draws
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content & Navigation ── */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 -mt-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 sm:p-2.5 rounded-2xl border border-border shadow-md">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {[
              { id: "ALL", label: "All Raffles" },
              { id: "ACTIVE", label: "Live & Active" },
              { id: "UPCOMING", label: "Upcoming" },
              { id: "COMPLETED", label: "Past Draws" },
            ].map((t) => {
              const isSelected = tab === t.id;
              return (
                <Link
                  key={t.id}
                  href={`/raffles?tab=${t.id}`}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          <Link
            href="/account/raffles"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 transition-colors ml-auto"
          >
            <Ticket className="h-4 w-4" />
            <span>My Tickets & Wins</span>
          </Link>
        </div>

        {/* Raffles Grid */}
        <div className="mt-8">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 text-sm">
              Failed to load raffles: {error}
            </div>
          )}

          {raffles.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-border p-8">
              <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="text-lg font-black text-foreground">No raffles found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                There are currently no raffles in this category. Check back soon or explore our active giveaways!
              </p>
              <Link
                href="/raffles"
                className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold"
              >
                View All Raffles
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {raffles.map((raffle) => (
                <RaffleCard key={raffle.id} raffle={raffle} />
              ))}
            </div>
          )}
        </div>

        {/* How It Works & Transparency Section */}
        <section className="mt-16 bg-white rounded-3xl p-6 sm:p-10 border border-border shadow-xs">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[11px] font-black uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
              Fair & Transparent
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2 text-foreground">
              How Our Raffles Work
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              Every giveaway adheres to transparent rules, auditable random selections, and guaranteed delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                <Ticket className="h-6 w-6" />
              </div>
              <h3 className="font-black text-base text-foreground">1. Claim Your Free Ticket</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Log into your Complete Home Sollution account, open any active raffle, and generate your unique ticket codes instantly.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-3">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-black text-base text-foreground">2. Cryptographic Winner Draw</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                When the campaign closes, winners are selected randomly using an auditable, seeded algorithm with public draw records.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="font-black text-base text-foreground">3. Direct Prize Fulfilment</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Free product winners enter shipping address for free doorstep delivery. Special discount winners easily purchase at their exclusive winning rate!
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

