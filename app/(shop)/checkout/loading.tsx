export default function CheckoutLoading() {
  return (
    <main className="bg-background pb-32 pt-4 lg:pb-12 lg:pt-10 w-full animate-pulse">
      <div className="container mx-auto px-4 md:px-6 xl:px-8 max-w-full">
        {/* Header skeleton */}
        <div className="mb-6 md:mb-8 flex items-center justify-between">
          <div className="h-8 w-44 bg-stone-300 rounded-lg" />
          <div className="h-4 w-32 bg-stone-100 rounded" />
        </div>

        {/* Two-column checkout layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Form Fields Skeleton */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Fulfillment Selector */}
            <div className="rounded-2xl border border-border bg-white p-5 space-y-3">
              <div className="h-5 w-36 bg-stone-200 rounded" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-14 bg-stone-100 rounded-xl" />
                <div className="h-14 bg-stone-100 rounded-xl" />
              </div>
            </div>

            {/* Address inputs */}
            <div className="rounded-2xl border border-border bg-white p-5 space-y-4">
              <div className="h-5 w-40 bg-stone-200 rounded" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-stone-100 rounded-lg" />
                <div className="h-10 bg-stone-100 rounded-lg" />
              </div>
              <div className="h-10 bg-stone-100 rounded-lg" />
              <div className="grid grid-cols-3 gap-4">
                <div className="h-10 bg-stone-100 rounded-lg" />
                <div className="h-10 bg-stone-100 rounded-lg" />
                <div className="h-10 bg-stone-100 rounded-lg" />
              </div>
            </div>

            {/* Payment method */}
            <div className="rounded-2xl border border-border bg-white p-5 space-y-3">
              <div className="h-5 w-32 bg-stone-200 rounded" />
              <div className="h-16 bg-stone-100 rounded-xl" />
            </div>
          </div>

          {/* Right: Order Summary Sidebar Skeleton */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="rounded-2xl border border-border bg-white p-5 space-y-4">
              <div className="h-6 w-36 bg-stone-200 rounded pb-3 border-b border-border" />
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="h-14 w-14 rounded-lg bg-stone-200 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-3/4 bg-stone-200 rounded" />
                    <div className="h-3 w-1/3 bg-stone-100 rounded" />
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-20 bg-stone-100 rounded" />
                  <div className="h-4 w-16 bg-stone-200 rounded" />
                </div>
                <div className="flex justify-between">
                  <div className="h-4 w-16 bg-stone-100 rounded" />
                  <div className="h-4 w-12 bg-stone-100 rounded" />
                </div>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <div className="h-5 w-16 bg-stone-200 rounded" />
                <div className="h-6 w-24 bg-stone-300 rounded" />
              </div>
              <div className="h-12 w-full bg-primary/25 rounded-xl pt-2" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
