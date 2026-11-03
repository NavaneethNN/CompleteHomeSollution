export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-secondary/30 py-6 lg:py-12 animate-pulse">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-36 bg-stone-200 rounded mb-6" />

        {/* Header skeleton */}
        <div className="mb-8 space-y-1.5">
          <div className="h-8 w-48 bg-stone-300 rounded-lg" />
          <div className="h-4 w-64 bg-stone-100 rounded" />
        </div>

        {/* Layout with sidebar and content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 items-start">
          {/* Sidebar skeleton */}
          <div className="rounded-2xl border border-border bg-white p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-stone-100 rounded-xl" />
            ))}
          </div>

          {/* Main content area skeleton */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl border border-border bg-white p-6 space-y-4">
              <div className="h-6 w-40 bg-stone-200 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-24 bg-stone-100 rounded-xl" />
                <div className="h-24 bg-stone-100 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
