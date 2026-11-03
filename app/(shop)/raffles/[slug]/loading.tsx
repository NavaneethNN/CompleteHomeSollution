export default function RaffleDetailLoading() {
  return (
    <div className="min-h-screen bg-[#fdfbf9] animate-pulse">
      <div className="border-b border-border bg-white py-3">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="h-4 w-44 bg-stone-200 rounded" />
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="aspect-[4/3] w-full rounded-2xl bg-stone-200" />
            <div className="h-6 w-3/4 bg-stone-300 rounded" />
            <div className="h-20 w-full bg-stone-100 rounded-xl" />
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-border bg-white p-6 space-y-5">
            <div className="h-6 w-36 bg-stone-200 rounded" />
            <div className="h-16 bg-stone-100 rounded-xl" />
            <div className="h-12 w-full bg-primary/25 rounded-xl" />
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full bg-stone-100 rounded" />
              <div className="h-4 w-5/6 bg-stone-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
