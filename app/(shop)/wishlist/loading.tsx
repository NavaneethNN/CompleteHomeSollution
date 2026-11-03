export default function WishlistLoading() {
  return (
    <main className="bg-white py-8 md:py-16 animate-pulse">
      <div className="container mx-auto px-4 sm:px-5 md:px-6 xl:px-8">
        <div className="text-center mb-8 md:mb-10 space-y-2">
          <div className="h-4 w-32 bg-stone-200 rounded mx-auto" />
          <div className="h-8 w-56 bg-stone-300 rounded-lg mx-auto" />
        </div>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-white p-3 space-y-3">
              <div className="aspect-square w-full rounded-xl bg-stone-200" />
              <div className="h-4 w-3/4 bg-stone-200 rounded" />
              <div className="h-4 w-1/3 bg-stone-100 rounded" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
