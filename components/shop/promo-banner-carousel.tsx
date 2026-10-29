"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PromotionBannerItem } from "@/lib/actions/promotions";

interface PromoBannerCarouselProps {
  promotions: PromotionBannerItem[];
  priority?: boolean;
  className?: string;
}

export function PromoBannerCarousel({
  promotions,
  priority = false,
  className = "",
}: PromoBannerCarouselProps) {
  const banners = promotions.filter(
    (p) => p.showInBanner && p.bannerImage && p.isActive
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const count = banners.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % count);
  }, [count]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + count) % count);
  }, [count]);

  // Autoplay timer
  useEffect(() => {
    if (count <= 1 || isPaused) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 5500);

    return () => clearInterval(interval);
  }, [count, isPaused, nextSlide]);

  if (count === 0) return null;

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 45) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <section
      aria-label="Promotional Banners"
      className={`relative w-full overflow-hidden ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="container mx-auto px-4 sm:px-6 xl:px-8">
        <div className="relative w-full rounded-2xl overflow-hidden shadow-xs border border-border bg-secondary/50 group">
          {/* Slides container */}
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {banners.map((banner, index) => {
              const bannerContent = (
                <div className="relative w-full aspect-[16/6] sm:aspect-[16/5] md:aspect-[4/1] min-h-[120px] sm:min-h-[160px] md:min-h-[200px] overflow-hidden bg-secondary">
                  {banner.bannerImage && (
                    <Image
                      src={banner.bannerImage}
                      alt={banner.title}
                      fill
                      priority={priority && index === 0}
                      sizes="(max-width: 640px) 100vw, (max-width: 1200px) 95vw, 1400px"
                      className="object-cover object-center transition-transform duration-700 group-hover:scale-[1.01]"
                    />
                  )}
                  {/* Subtle hover gradient */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                </div>
              );

              return (
                <div key={banner.id} className="min-w-full shrink-0">
                  {banner.linkUrl ? (
                    <Link
                      href={banner.linkUrl}
                      className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                      aria-label={banner.title}
                    >
                      {bannerContent}
                    </Link>
                  ) : (
                    bannerContent
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation Arrows for multiple banners */}
          {count > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  prevSlide();
                }}
                aria-label="Previous promotional banner"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-foreground shadow-md flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 focus:opacity-100 focus:outline-none"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  nextSlide();
                }}
                aria-label="Next promotional banner"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-foreground shadow-md flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 focus:opacity-100 focus:outline-none"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </>
          )}

          {/* Dot Indicators */}
          {count > 1 && (
            <div className="absolute bottom-2.5 sm:bottom-3.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-black/35 px-2.5 py-1 rounded-full backdrop-blur-xs">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentIndex(i);
                  }}
                  className={`h-1.5 sm:h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? "w-4 sm:w-6 bg-white"
                      : "w-1.5 sm:w-2 bg-white/50 hover:bg-white/80"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
