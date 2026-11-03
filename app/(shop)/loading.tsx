export default function ShopLoading() {
  return (
    <div className="min-h-screen bg-background py-8 md:py-12 animate-pulse">
      <div className="container mx-auto px-4 sm:px-6 xl:px-8">
        <div className="h-8 w-48 bg-stone-200 rounded-lg mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-white p-3 space-y-3">
              <div className="aspect-square w-full rounded-xl bg-stone-200" />
              <div className="h-4 w-3/4 bg-stone-200 rounded" />
              <div className="h-3 w-1/2 bg-stone-100 rounded" />
              <div className="flex justify-between items-center pt-2">
                <div className="h-5 w-16 bg-stone-200 rounded" />
                <div className="h-7 w-20 bg-stone-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
