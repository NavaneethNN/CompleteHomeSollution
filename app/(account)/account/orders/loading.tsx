export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-secondary/30 py-6 lg:py-12 animate-pulse">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-4 w-32 bg-stone-200 rounded mb-6" />
        <div className="h-8 w-44 bg-stone-300 rounded-lg mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 items-start">
          <div className="rounded-2xl border border-border bg-white p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-stone-100 rounded-xl" />
            ))}
          </div>

          <div className="lg:col-span-3 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-white p-5 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <div className="space-y-1">
                    <div className="h-4 w-28 bg-stone-200 rounded" />
                    <div className="h-3 w-36 bg-stone-100 rounded" />
                  </div>
                  <div className="h-6 w-20 bg-stone-200 rounded-full" />
                </div>
                <div className="flex gap-3">
                  <div className="h-16 w-16 bg-stone-200 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 bg-stone-200 rounded" />
                    <div className="h-4 w-24 bg-stone-300 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
