"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageIndex = Math.min(selectedIndex, Math.max(0, images.length - 1));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (expanded && dialog && !dialog.open) dialog.showModal();
    if (!expanded && dialog?.open) dialog.close();
  }, [expanded]);

  useEffect(() => {
    if (!expanded || images.length < 2) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setSelectedIndex(index => (index - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") setSelectedIndex(index => (index + 1) % images.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [expanded, images.length]);

  if (!images.length) {
    return <div className="flex aspect-square items-center justify-center rounded-2xl bg-secondary text-sm text-muted-foreground">Product photography coming soon</div>;
  }

  const changeImage = (direction: -1 | 1) => setSelectedIndex(index => (index + direction + images.length) % images.length);

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="relative aspect-[4/3] sm:aspect-square overflow-hidden rounded-xl bg-[#f5f2ee] sm:rounded-3xl">
        <Image
          src={images[imageIndex]}
          alt={`${productName}, view ${imageIndex + 1} of ${images.length}`}
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 620px"
          className="object-contain p-1.5 sm:p-3"
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand product image"
          className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3 flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white/95 text-foreground shadow-xs transition-colors hover:text-primary"
        >
          <Expand className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => changeImage(-1)}
              aria-label="Previous product image"
              className="absolute left-2.5 top-1/2 flex h-8 w-8 sm:h-11 sm:w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-foreground shadow-xs transition-colors hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              type="button"
              onClick={() => changeImage(1)}
              aria-label="Next product image"
              className="absolute right-2.5 top-1/2 flex h-8 w-8 sm:h-11 sm:w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-foreground shadow-xs transition-colors hover:text-primary"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <span className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-foreground shadow-xs">
              {imageIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Product image thumbnails">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`View product image ${index + 1}`}
              aria-current={imageIndex === index ? "true" : undefined}
              className={cn(
                "relative h-13 w-13 sm:h-[72px] sm:w-[72px] shrink-0 overflow-hidden rounded-lg sm:rounded-xl border-2 bg-[#f5f2ee] transition-all",
                imageIndex === index ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-primary/40"
              )}
            >
              <Image src={image} alt="" fill sizes="72px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
      <dialog ref={dialogRef} onClose={() => setExpanded(false)} aria-label={`${productName} enlarged image`} className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-black/95 p-4 text-white backdrop:bg-black/90">
        <div className="flex h-full w-full items-center justify-center" onClick={() => setExpanded(false)}>
          <button type="button" onClick={() => setExpanded(false)} aria-label="Close enlarged image" className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-foreground"><X className="h-5 w-5" /></button>
          {images.length > 1 && <button type="button" onClick={event => { event.stopPropagation(); changeImage(-1); }} aria-label="Previous enlarged image" className="absolute left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-foreground sm:left-8"><ChevronLeft className="h-5 w-5" /></button>}
          <div className="relative h-[80vh] w-[90vw] max-w-5xl" onClick={event => event.stopPropagation()}><Image src={images[imageIndex]} alt={`${productName}, enlarged view ${imageIndex + 1}`} fill sizes="90vw" className="object-contain" /></div>
          {images.length > 1 && <button type="button" onClick={event => { event.stopPropagation(); changeImage(1); }} aria-label="Next enlarged image" className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-foreground sm:right-8"><ChevronRight className="h-5 w-5" /></button>}
        </div>
      </dialog>
    </div>
  );
}
