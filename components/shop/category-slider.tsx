"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  _count: { products: number };
}

export function CategorySlider({ categories }: { readonly categories: Category[] }) {
  const items = categories.filter((category) => category._count.products > 0);
  const trackRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ index: 0, atStart: true, atEnd: true });

  const updatePosition = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.firstElementChild as HTMLElement | null;
    const step = firstCard ? firstCard.getBoundingClientRect().width + 16 : 1;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    setPosition({
      index: Math.min(items.length - 1, Math.round(track.scrollLeft / step)),
      atStart: track.scrollLeft <= 2,
      atEnd: track.scrollLeft >= maxScroll - 2,
    });
  }, [items.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updatePosition]);

  const move = (direction: -1 | 1) => {
    const track = trackRef.current;
    const firstCard = track?.firstElementChild as HTMLElement | null;
    if (!track || !firstCard) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * (firstCard.getBoundingClientRect().width + 16), behavior: reduceMotion ? "instant" : "smooth" });
  };

  if (!items.length) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={updatePosition}
        aria-label="Shop by room categories"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group relative isolate block aspect-[4/5] w-[74%] flex-none snap-start overflow-hidden rounded-2xl bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-[480px]:w-[46%] md:w-[31%] lg:w-[23.5%]"
          >
            {category.image ? (
              <Image
                src={category.image}
                alt=""
                fill
                sizes="(max-width: 479px) 74vw, (max-width: 767px) 46vw, (max-width: 1023px) 31vw, 24vw"
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
              <h3 className="text-lg font-semibold leading-tight text-white sm:text-xl">{category.name}</h3>
              <p className="mt-1 text-xs text-white/75">{category._count.products} {category._count.products === 1 ? "piece" : "pieces"}</p>
            </div>
          </Link>
        ))}
      </div>

      {items.length > 1 && (
        <div className="mt-5 flex items-center justify-between gap-5">
          <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">{String(position.index + 1).padStart(2, "0")}</span>
            <span className="mx-2 text-border">/</span>
            {String(items.length).padStart(2, "0")}
          </p>
          <div className="h-0.5 max-w-40 flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((position.index + 1) / items.length) * 100}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => move(-1)} disabled={position.atStart} aria-label="Previous room" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-35">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => move(1)} disabled={position.atEnd} aria-label="Next room" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-35">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
