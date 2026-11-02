export default function CartLoading() {
  return (
    <main className="bg-background py-8 md:py-12 animate-pulse">
      <div className="container mx-auto px-4 md:px-6 xl:px-8">
        {/* Title skeleton */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-7 w-40 bg-stone-200 rounded-lg" />
            <div className="h-4 w-20 bg-stone-100 rounded" />
          </div>
          <div className="h-4 w-14 bg-stone-100 rounded" />
        </div>

        {/* Layout skeleton */}
        <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          {/* Cart items skeleton */}
          <section className="min-w-0 space-y-3 sm:space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-border bg-white p-3 sm:gap-4 sm:p-4"
              >
                <div className="h-[72px] w-[72px] sm:h-20 sm:w-20 rounded-lg bg-stone-200 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5 flex-1 max-w-sm">
                      <div className="h-4 w-3/4 bg-stone-200 rounded" />
                      <div className="h-3 w-1/3 bg-stone-100 rounded" />
                    </div>
                    <div className="h-6 w-6 bg-stone-100 rounded-lg" />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="h-5 w-16 bg-stone-200 rounded" />
                    <div className="h-7 w-24 bg-stone-100 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Cart summary skeleton */}
          <div className="space-y-4">
            <div className="rounded-xl sm:rounded-2xl border border-border bg-white p-4 sm:p-5 space-y-4">
              <div className="h-5 w-32 bg-stone-200 rounded pb-3 border-b border-border" />
              <div className="space-y-2.5">
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-stone-100 rounded" />
                  <div className="h-4 w-16 bg-stone-200 rounded" />
                </div>
                <div className="flex justify-between">
                  <div className="h-4 w-20 bg-stone-100 rounded" />
                  <div className="h-4 w-28 bg-stone-100 rounded" />
                </div>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <div className="h-4 w-16 bg-stone-200 rounded" />
                <div className="h-6 w-20 bg-stone-300 rounded" />
              </div>
              <div className="h-11 w-full bg-primary/20 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

