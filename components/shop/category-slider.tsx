"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  _count: { products: number };
}

interface CategorySliderProps {
  categories: Category[];
}

export function CategorySlider({ categories }: CategorySliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);

  const updateVisibleCount = useCallback(() => {
    const w = window.innerWidth;
    if (w < 640) setVisibleCount(2);
    else if (w < 768) setVisibleCount(3);
    else if (w < 1024) setVisibleCount(4);
    else setVisibleCount(5);
  }, []);

  useEffect(() => {
    updateVisibleCount();
    window.addEventListener("resize", updateVisibleCount);
    return () => window.removeEventListener("resize", updateVisibleCount);
  }, [updateVisibleCount]);

  const maxIndex = Math.max(0, categories.length - visibleCount);

  // Auto-slide every 3.5 s — only when there are more items than visible
  useEffect(() => {
    if (isPaused || maxIndex === 0) return;
    const id = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 3500);
    return () => clearInterval(id);
  }, [isPaused, maxIndex]);

  const slide = (dir: "left" | "right") => {
    setCurrentIndex((prev) => {
      if (dir === "left") return Math.max(0, prev - 1);
      return Math.min(maxIndex, prev + 1);
    });
  };

  const gap = 16; // gap-4 = 16px

  const translateX = (() => {
    const el = trackRef.current?.parentElement;
    if (!el) return "0px";
    const containerWidth = el.clientWidth;
    const cardWidth = (containerWidth - gap * (visibleCount - 1)) / visibleCount;
    return `${-(currentIndex * (cardWidth + gap))}px`;
  })();

  // Dot indicators — one dot per "page" of visibleCount items
  const pageCount = maxIndex + 1; // number of scroll positions

  return (
    <div
      className="relative group/slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Track wrapper */}
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex gap-4 transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(${translateX})` }}
        >
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group relative shrink-0 aspect-[3/4] rounded-xl overflow-hidden bg-secondary"
              style={{
                width: `calc((100% - ${gap * (visibleCount - 1)}px) / ${visibleCount})`,
              }}
            >
              {cat.image ? (
                <Image
                  src={cat.image}
                  alt={cat.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                />
              ) : (
                // Placeholder when no image — shows category initial
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <span className="text-4xl font-black text-primary/30">{cat.name[0]}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-bold text-sm md:text-base leading-tight">{cat.name}</h3>
                <p className="text-white/70 text-xs mt-1">
                  {cat._count.products} {cat._count.products === 1 ? "product" : "products"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Prev arrow */}
      <button
        onClick={() => slide("left")}
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center transition-all duration-200",
          currentIndex > 0
            ? "opacity-0 group-hover/slider:opacity-100 hover:bg-white hover:scale-110"
            : "opacity-0 pointer-events-none"
        )}
        aria-label="Previous categories"
      >
        <ChevronLeft className="h-4 w-4 text-foreground" />
      </button>

      {/* Next arrow */}
      <button
        onClick={() => slide("right")}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center transition-all duration-200",
          currentIndex < maxIndex
            ? "opacity-0 group-hover/slider:opacity-100 hover:bg-white hover:scale-110"
            : "opacity-0 pointer-events-none"
        )}
        aria-label="Next categories"
      >
        <ChevronRight className="h-4 w-4 text-foreground" />
      </button>

      {/* Dot indicators — only shown when there are multiple scroll positions */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4" role="tablist" aria-label="Category slider position">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === currentIndex}
              aria-label={`Go to position ${i + 1}`}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "rounded-full transition-all duration-300",
                i === currentIndex
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-border hover:bg-primary/40"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
