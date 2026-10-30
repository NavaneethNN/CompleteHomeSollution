import { getPublicRaffles } from "@/lib/actions/raffle";
import { RaffleCard } from "@/components/raffle/raffle-card";
import { Gift, Trophy, ShieldCheck, Sparkles, CheckCircle2, Ticket, ChevronRight, ArrowRight } from "lucide-react";
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
  const statusFilter =
    tab === "ACTIVE"
      ? "ACTIVE"
      : tab === "UPCOMING"
      ? "UPCOMING"
      : tab === "COMPLETED"
      ? "COMPLETED"
      : "ALL";

  const { raffles, error } = await getPublicRaffles({
    status: statusFilter,
  });

  const totalPrizeValue = raffles.reduce(
    (sum, r) => sum + r.prizes.reduce((pSum, p) => pSum + p.value * p.quantity, 0),
    0
  );

  return (
    <div className="min-h-screen bg-white">
      {/* ── Sub-header / Breadcrumbs ── */}
      <div className="border-b border-border bg-[#fdfbf9]">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold">Raffles & Giveaways</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Australian Owned
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Guaranteed Prize Delivery
            </span>
          </div>
        </div>
      </div>

      {/* ── Hero Section (Light, Warm, CHS Site Theme) ── */}
      <section className="bg-[#f7f3ed] py-10 sm:py-16 md:py-20 border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-3.5 border border-primary/20">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>CHS COMMUNITY GIVEAWAYS</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.18] mb-3">
            Win Handcrafted Home Luxuries. <br />
            <span className="text-primary font-bold">100% Free Entry & Multi-Winner Draws.</span>
          </h1>

          <p className="text-xs sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
            Welcome to the Complete Home Sollution giveaway arena. Enter free promotional draws for premium timber platform beds, ergonomic chairs, and home essentials, or unlock deep winner-only purchase privileges.
          </p>

          {/* Clean Metric Cards in Site Theme */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs text-center">
              <span className="block text-2xl sm:text-3xl font-bold text-foreground">
                ${totalPrizeValue > 0 ? totalPrizeValue.toLocaleString() : "2,500+"}
              </span>
              <span className="text-xs text-muted-foreground font-medium mt-0.5 block">
                Prize Pool Value
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs text-center">
              <span className="block text-2xl sm:text-3xl font-bold text-primary">
                {raffles.filter((r) => r.status === "ACTIVE").length || 2}
              </span>
              <span className="text-xs text-muted-foreground font-medium mt-0.5 block">
                Active Giveaways
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs text-center">
              <span className="block text-2xl sm:text-3xl font-bold text-emerald-700">
                100% Free
              </span>
              <span className="text-xs text-muted-foreground font-medium mt-0.5 block">
                No Purchase Required
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs text-center">
              <span className="block text-2xl sm:text-3xl font-bold text-foreground">
                Verified
              </span>
              <span className="text-xs text-muted-foreground font-medium mt-0.5 block">
                Cryptographic Draws
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content & Navigation ── */}
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-6xl">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
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
                  className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                    isSelected
                      ? "bg-primary text-white shadow-xs"
                      : "bg-white border border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          <Link
            href="/account/raffles"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-2 text-xs sm:text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors shadow-xs ml-auto"
          >
            <Ticket className="h-4 w-4 text-primary" />
            <span>My Tickets & Wins</span>
          </Link>
        </div>

        {/* Raffles Grid */}
        <div className="mt-8">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">
              Failed to load raffles: {error}
            </div>
          )}

          {raffles.length === 0 ? (
            <div className="text-center py-20 bg-[#f7f3ed] rounded-2xl border border-border p-8">
              <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="text-lg font-semibold text-foreground">No raffles found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                There are currently no raffles in this category. Check back soon or explore our active giveaways!
              </p>
              <Link
                href="/raffles"
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
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

        {/* ── How It Works (Site Theme) ── */}
        <section className="mt-16 bg-white rounded-2xl p-6 sm:p-10 border border-border shadow-xs">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2">
              FAIR & TRANSPARENT
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              How Our Raffles Work
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
              Every giveaway adheres to transparent rules, auditable random selections, and guaranteed delivery across Australia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-[#f7f3ed] border border-border/60 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white border border-border/80 shadow-xs flex items-center justify-center text-primary mb-4 font-bold">
                <Ticket className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-base text-foreground mb-2">1. Claim Your Free Ticket</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Log into your Complete Home Sollution account, open any active raffle, and generate your unique verifiable ticket codes instantly.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#f7f3ed] border border-border/60 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white border border-border/80 shadow-xs flex items-center justify-center text-primary mb-4 font-bold">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-base text-foreground mb-2">2. Cryptographic Winner Draw</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When the campaign closes, winners are selected randomly using an auditable, seeded algorithm with transparent public draw records.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#f7f3ed] border border-border/60 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white border border-border/80 shadow-xs flex items-center justify-center text-emerald-700 mb-4 font-bold">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-base text-foreground mb-2">3. Direct Prize Delivery</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Free product winners provide shipping details for complimentary doorstep delivery. Special discount winners easily purchase at their exclusive winning rate!
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
