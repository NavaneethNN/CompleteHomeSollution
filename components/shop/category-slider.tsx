import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  _count: { products: number };
}

export function CategorySlider({ categories }: { readonly categories: Category[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/categories/${category.slug}`}
          className="group relative isolate block aspect-[4/5] overflow-hidden rounded-2xl bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:aspect-[3/4]"
        >
          {category.image ? (
            <Image
              src={category.image}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#eee4d8] to-[#d9cabb] text-6xl font-semibold text-white/70">
              {category.name[0]}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/15 text-white backdrop-blur-sm transition-colors group-hover:bg-white group-hover:text-foreground">
            <ArrowUpRight className="h-4 w-4" />
          </span>
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
            <h3 className="text-base font-semibold leading-tight text-white sm:text-lg">{category.name}</h3>
            <p className="mt-1 text-xs text-white/75">{category._count.products} {category._count.products === 1 ? "piece" : "pieces"}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
