export default function MembershipLoading() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      {/* Sub-header / Breadcrumbs skeleton */}
      <div className="border-b border-border bg-[#fdfbf9]">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="h-4 w-40 bg-stone-200 rounded" />
          <div className="hidden sm:block h-4 w-48 bg-stone-200 rounded" />
        </div>
      </div>

      {/* Hero Section skeleton */}
      <section className="bg-[#f7f3ed] py-8 sm:py-14 md:py-20 border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="max-w-2xl space-y-4">
            <div className="h-6 w-36 bg-stone-300/80 rounded-full" />
            <div className="space-y-2">
              <div className="h-10 sm:h-12 w-3/4 bg-stone-300 rounded-lg" />
              <div className="h-10 sm:h-12 w-1/2 bg-stone-300 rounded-lg" />
            </div>
            <div className="h-4 w-full bg-stone-200 rounded" />
            <div className="h-4 w-5/6 bg-stone-200 rounded" />

            {/* Benefit pills skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-4 border-y border-stone-200">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-stone-200/90 rounded" />
              ))}
            </div>

            {/* CTA button skeleton */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
              <div className="h-12 w-56 bg-primary/30 rounded-full" />
              <div className="h-4 w-44 bg-stone-200 rounded" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits / Math Cards skeleton */}
      <section className="py-10 sm:py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="h-7 w-48 bg-stone-200 rounded mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-56 bg-stone-100 rounded-2xl border border-stone-200 p-6 space-y-4">
                <div className="h-4 w-24 bg-stone-200 rounded" />
                <div className="h-6 w-40 bg-stone-300 rounded" />
                <div className="h-16 bg-stone-200/60 rounded" />
                <div className="h-8 bg-stone-200 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calculator Section skeleton */}
      <section className="py-10 sm:py-16 bg-[#f7f3ed] border-y border-border">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="bg-white rounded-3xl border border-stone-200 p-8 space-y-6">
            <div className="h-6 w-52 bg-stone-200 rounded" />
            <div className="h-10 w-full bg-stone-100 rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-28 bg-stone-100 rounded-xl" />
              <div className="h-28 bg-stone-100 rounded-xl" />
              <div className="h-28 bg-stone-100 rounded-xl" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

