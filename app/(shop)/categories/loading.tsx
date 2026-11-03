export default function CategoriesLoading() {
  return (
    <main className="container mx-auto px-5 py-12 animate-pulse">
      <div className="h-9 w-64 bg-stone-300 rounded-lg mb-2" />
      <div className="h-4 w-80 bg-stone-100 rounded mb-8" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card space-y-3">
            <div className="aspect-[16/9] w-full bg-stone-200" />
            <div className="p-5 space-y-2">
              <div className="h-5 w-40 bg-stone-200 rounded" />
              <div className="h-4 w-20 bg-stone-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
