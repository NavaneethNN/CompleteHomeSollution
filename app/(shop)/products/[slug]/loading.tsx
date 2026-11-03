export default function ProductDetailLoading() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="bg-white border-b border-border">
        <div className="container mx-auto px-4 md:px-6 xl:px-8 py-3">
          <div className="h-4 w-52 bg-stone-200 rounded" />
        </div>
      </div>

      <main className="container mx-auto px-4 md:px-6 xl:px-8 py-6 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left Column: Image Gallery Skeleton */}
          <div className="space-y-4">
            <div className="aspect-square w-full rounded-2xl bg-stone-200" />
            <div className="grid grid-cols-5 gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-stone-200" />
              ))}
            </div>
          </div>

          {/* Right Column: Product Info & Actions Skeleton */}
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="h-5 w-24 bg-stone-200 rounded-full" />
              <div className="h-8 md:h-10 w-4/5 bg-stone-300 rounded-lg" />
              <div className="h-4 w-32 bg-stone-100 rounded" />
            </div>

            {/* Price Box Skeleton */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-baseline gap-3">
                <div className="h-8 w-28 bg-stone-300 rounded" />
                <div className="h-5 w-20 bg-stone-200 rounded line-through" />
              </div>
              <div className="h-4 w-44 bg-stone-200 rounded" />
            </div>

            {/* Variant options skeleton */}
            <div className="space-y-3 pt-2">
              <div className="h-4 w-28 bg-stone-200 rounded" />
              <div className="flex gap-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-9 w-20 bg-stone-200 rounded-lg" />
                ))}
              </div>
            </div>

            {/* Add to Cart button skeleton */}
            <div className="pt-4 space-y-3">
              <div className="h-12 w-full bg-primary/25 rounded-xl" />
              <div className="h-4 w-3/4 mx-auto bg-stone-100 rounded" />
            </div>

            {/* Assurance badges skeleton */}
            <div className="pt-6 grid grid-cols-2 gap-3 border-t border-border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-stone-100 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
