"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { PromotionBannerItem } from "@/lib/actions/promotions";

interface PromoPopupProps {
  promotions: PromotionBannerItem[];
}

export function PromoPopup({ promotions }: PromoPopupProps) {
  const popupPromos = promotions.filter(
    (p) => p.showInPopup && p.popupImage && p.isActive
  );

  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (popupPromos.length === 0) return;

    // Check if user already dismissed the popup in this session
    try {
      const dismissed = sessionStorage.getItem("chs_promo_popup_dismissed");
      if (!dismissed) {
        // Small delay so page content renders smoothly first
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 750);
        return () => clearTimeout(timer);
      }
    } catch {
      // If sessionStorage fails, default open once
      setIsOpen(true);
    }
  }, [popupPromos.length]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    try {
      sessionStorage.setItem("chs_promo_popup_dismissed", "true");
    } catch {
      // ignore storage error
    }
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen || popupPromos.length === 0) return null;

  const currentPromo = popupPromos[currentIndex] || popupPromos[0];
  const hasMultiple = popupPromos.length > 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? popupPromos.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === popupPromos.length - 1 ? 0 : prev + 1));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={currentPromo.title || "Special Offer"}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-300"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-[420px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20 transition-all scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          aria-label="Close promotion popup"
          className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-transform hover:scale-110 shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Square Poster Image */}
        <Link
          href={currentPromo.linkUrl || "/products"}
          onClick={handleClose}
          className="block relative aspect-square w-full bg-secondary overflow-hidden group cursor-pointer"
        >
          {currentPromo.popupImage && (
            <Image
              src={currentPromo.popupImage}
              alt={currentPromo.title}
              fill
              priority
              sizes="(max-width: 640px) 90vw, 420px"
              className="object-cover transition-transform duration-500 group-hover:scale-102"
            />
          )}

          {/* Subtitle / CTA pill hover overlay if link is provided */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pt-10 text-white flex items-end justify-between">
            <div className="min-w-0 pr-3">
              <p className="font-bold text-base leading-tight truncate text-white drop-shadow-sm">
                {currentPromo.title}
              </p>
              {currentPromo.subtitle && (
                <p className="text-xs text-white/90 line-clamp-1 mt-0.5">
                  {currentPromo.subtitle}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs font-bold bg-primary hover:bg-primary/90 text-white px-3.5 py-1.5 rounded-full shadow-md transition-transform group-hover:scale-105">
              {currentPromo.linkText || "Shop Now"} →
            </span>
          </div>
        </Link>

        {/* Navigation for multiple posters */}
        {hasMultiple && (
          <div className="absolute inset-y-0 inset-x-2 flex items-center justify-between pointer-events-none z-10">
            <button
              onClick={handlePrev}
              aria-label="Previous offer"
              className="pointer-events-auto w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition shadow-md"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next offer"
              className="pointer-events-auto w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition shadow-md"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Dots indicator */}
        {hasMultiple && (
          <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-xs">
            {popupPromos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIndex ? "w-4 bg-primary" : "w-1.5 bg-white/60"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
