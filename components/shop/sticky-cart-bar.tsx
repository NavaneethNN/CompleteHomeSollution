"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, X, Sparkles, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface StickyCartBarProps {
  isMember?: boolean;
}

export function StickyCartBar({ isMember = false }: StickyCartBarProps) {
  const items = useCartStore((state) => state.items);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Show after scrolling down
  useEffect(() => {
    const handleScroll = () => {
      if (items.length > 0 && !isDismissed) {
        // Show after scrolling 300px
        setIsVisible(window.scrollY > 300);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [items.length, isDismissed]);

  // Reset visibility when items change
  useEffect(() => {
    if (items.length === 0) {
      setIsVisible(false);
      setIsDismissed(false);
    }
  }, [items.length]);

  if (items.length === 0) return null;

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => {
    const price = isMember && item.product.memberPrice 
      ? item.product.memberPrice 
      : item.product.price;
    return sum + price * item.quantity;
  }, 0);

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg md:hidden transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      {/* Membership upsell banner */}
      {!isMember && (
        <div className="bg-primary/5 px-4 py-2 border-b border-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-foreground">
                Save with Membership
              </span>
            </div>
            <Link 
              href="/account/membership" 
              className="text-xs font-semibold text-primary hover:underline"
            >
              Learn more →
            </Link>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart className="h-6 w-6 text-primary" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              ${subtotal.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white font-bold px-4"
            asChild
          >
            <Link href="/cart">
              View Cart
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
          <button
            onClick={() => {
              setIsVisible(false);
              setIsDismissed(true);
            }}
            className="p-2 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
