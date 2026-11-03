export default function RafflesLoading() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      <div className="border-b border-border bg-[#fdfbf9] py-3">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="h-4 w-48 bg-stone-200 rounded" />
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-6xl space-y-8">
        <div className="max-w-xl space-y-3">
          <div className="h-6 w-32 bg-primary/20 rounded-full" />
          <div className="h-10 w-3/4 bg-stone-300 rounded-lg" />
          <div className="h-4 w-full bg-stone-200 rounded" />
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 border-b border-border pb-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-stone-200 rounded-lg" />
          ))}
        </div>

        {/* Raffles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-white p-4 space-y-4">
              <div className="aspect-[4/3] w-full bg-stone-200 rounded-xl" />
              <div className="h-5 w-3/4 bg-stone-200 rounded" />
              <div className="h-4 w-1/2 bg-stone-100 rounded" />
              <div className="h-10 w-full bg-stone-200 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
