export default function BlogLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white border-b border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <div className="h-10 sm:h-12 w-64 bg-stone-300 rounded-xl mx-auto" />
          <div className="h-4 w-96 bg-stone-100 rounded mx-auto" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* Search & Categories Skeleton */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="h-10 w-full sm:w-72 bg-stone-200 rounded-xl" />
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 w-20 bg-stone-200 rounded-full" />
            ))}
          </div>
        </div>

        {/* Blog Posts Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden space-y-4">
              <div className="aspect-[16/9] w-full bg-stone-200" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-24 bg-stone-100 rounded" />
                <div className="h-6 w-5/6 bg-stone-300 rounded" />
                <div className="h-3 w-full bg-stone-100 rounded" />
                <div className="h-3 w-4/5 bg-stone-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
