export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      {/* Search Bar Skeleton */}
      <div className="bg-slate-50 border-b border-slate-200 py-8">
        <div className="container mx-auto px-5 md:px-6 xl:px-8 max-w-screen-xl">
          <div className="max-w-2xl mx-auto h-14 bg-stone-200 rounded-xl" />
        </div>
      </div>

      <div className="container mx-auto px-5 md:px-6 xl:px-8 py-8 max-w-screen-xl">
        <div className="h-6 w-48 bg-stone-200 rounded mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-white p-3 space-y-3">
              <div className="aspect-square w-full rounded-xl bg-stone-200" />
              <div className="h-4 w-3/4 bg-stone-200 rounded" />
              <div className="h-3 w-1/2 bg-stone-100 rounded" />
              <div className="h-5 w-16 bg-stone-200 rounded pt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
