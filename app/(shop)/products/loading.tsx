export default function ProductsLoading() {
  return (
    <main className="min-h-screen bg-background animate-pulse">
      {/* Page header */}
      <div className="bg-white border-b border-border">
        <div className="container mx-auto px-4 md:px-6 xl:px-8 py-6 md:py-8">
          <div className="h-7 w-44 bg-stone-200 rounded-lg mb-2" />
          <div className="h-3 w-28 bg-stone-100 rounded" />
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 xl:px-8 py-6 md:py-8 space-y-6">
        {/* Category filter pills skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 w-24 bg-stone-200 rounded-full shrink-0" />
          ))}
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-white p-3 space-y-3">
              <div className="aspect-square w-full rounded-xl bg-stone-200" />
              <div className="h-4 w-3/4 bg-stone-200 rounded" />
              <div className="h-3 w-1/2 bg-stone-100 rounded" />
              <div className="flex justify-between items-center pt-2">
                <div className="h-5 w-16 bg-stone-200 rounded" />
                <div className="h-8 w-24 bg-stone-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
