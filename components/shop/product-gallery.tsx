"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No images available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Main Image */}
      <div className="relative w-full bg-muted rounded-lg overflow-hidden" style={{ aspectRatio: "1/1", maxHeight: "420px" }}>
        <img
          src={images[selectedIndex]}
          alt={`${productName} - Image ${selectedIndex + 1}`}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "relative w-14 h-14 bg-muted rounded-md overflow-hidden shrink-0 border transition-colors",
                selectedIndex === index
                  ? "border-primary"
                  : "border-transparent hover:border-border"
              )}
              aria-label={`View image ${index + 1}`}
            >
              <img
                src={image}
                alt={`${productName} thumbnail ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
