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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  // Auto-slide every 3 seconds
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused) return;

    const interval = setInterval(() => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 2) {
        // Reset to start
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        // Slide by one card width + gap
        const cardWidth = el.querySelector<HTMLElement>(":scope > a")?.offsetWidth ?? 240;
        el.scrollBy({ left: cardWidth + 16, behavior: "smooth" });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector<HTMLElement>(":scope > a")?.offsetWidth ?? 240;
    el.scrollBy({
      left: direction === "left" ? -(cardWidth + 16) : cardWidth + 16,
      behavior: "smooth",
    });
  };

  return (
    <div
      className="relative group/slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/categories/${cat.slug}`}
            className="group relative shrink-0 w-[45%] sm:w-[30%] md:w-[22%] lg:w-[18%] aspect-[3/4] rounded-xl overflow-hidden bg-secondary snap-start"
          >
            {cat.image && (
              <Image
                src={cat.image}
                alt={cat.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 18vw"
              />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Text overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-white font-bold text-sm md:text-base leading-tight">
                {cat.name}
              </h3>
              <p className="text-white/70 text-xs mt-1">
                {cat._count.products} {cat._count.products === 1 ? "product" : "products"}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={() => scroll("left")}
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center transition-all",
          canScrollLeft
            ? "opacity-0 group-hover/slider:opacity-100 hover:bg-white hover:scale-110"
            : "opacity-0 pointer-events-none"
        )}
        aria-label="Previous category"
      >
        <ChevronLeft className="h-4 w-4 text-foreground" />
      </button>

      <button
        onClick={() => scroll("right")}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center transition-all",
          canScrollRight
            ? "opacity-0 group-hover/slider:opacity-100 hover:bg-white hover:scale-110"
            : "opacity-0 pointer-events-none"
        )}
        aria-label="Next category"
      >
        <ChevronRight className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}
