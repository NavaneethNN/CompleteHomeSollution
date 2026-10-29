"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingBag, PhoneCall } from "lucide-react";
import { STORE_PHONE } from "@/lib/store-info";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ProductPopupModalProduct {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  price: number;
  memberPrice?: number | null;
  images: string[];
  stock: number;
  description?: string;
  isPreOrder?: boolean;
  variantId?: string | null;
  variantLabel?: string;
}

interface ProductPopupModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly product: ProductPopupModalProduct | null;
  readonly onConfirm: (quantity: number) => void | Promise<void>;
  readonly confirmLabel?: string;
}

export function ProductPopupModal({
  open,
  onOpenChange,
  product,
  onConfirm,
  confirmLabel = "Add to Cart",
}: Readonly<ProductPopupModalProps>) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (open) {
      setQuantity(1);
    }
  }, [open, product?.id, product?.variantId]);

  if (!product) {
    return null;
  }

  const image = product.images[0] ?? "/placeholder.jpg";
  const isOutOfStock = product.stock <= 0;
  const unitPrice = product.price;
  const memberPrice = product.memberPrice ?? null;
  let stockMessage: string | null = null;
  let stockMessageTone: "destructive" | "amber" | null = null;

  if (isOutOfStock) {
    stockMessage = "This item is currently out of stock.";
    stockMessageTone = "destructive";
  } else if (product.stock <= 5) {
    stockMessage = `Only ${product.stock} left in stock.`;
    stockMessageTone = "amber";
  }

  const handleConfirm = async () => {
    await onConfirm(quantity);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg md:max-w-4xl max-h-[90vh] overflow-y-auto border-border bg-white p-0 rounded-2xl md:rounded-[28px] shadow-2xl">
        <div className="grid md:grid-cols-[0.92fr_1.08fr]">
          <div className="relative aspect-[16/10] sm:aspect-auto h-48 sm:h-64 md:h-auto md:min-h-[460px] bg-muted w-full shrink-0">
            <Image
              src={image}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 45vw"
              priority
            />
          </div>

          <div className="flex flex-col gap-3.5 sm:gap-4 md:gap-5 p-4 sm:p-6 md:p-8">
            <DialogHeader className="text-left space-y-1.5 sm:space-y-2">
              <DialogTitle className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-foreground line-clamp-2">
                {product.name}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm md:text-base text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-3">
                {product.description ?? "Review the product details and choose your quantity before adding it to your cart."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1">
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl sm:text-3xl font-black text-foreground">
                  ${unitPrice.toLocaleString()}
                </span>
                {memberPrice ? (
                  <span className="text-xs sm:text-sm text-primary font-semibold">
                    Member: ${memberPrice.toLocaleString()}
                  </span>
                ) : null}
              </div>

              {product.variantLabel ? (
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {product.variantLabel}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-border bg-secondary/40 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-foreground">Quantity</p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">Default starts at 1.</p>
                </div>
                <div className="flex items-center rounded-xl border border-border bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground"
                    disabled={isOutOfStock}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                  <span className="min-w-9 sm:min-w-12 px-2 sm:px-3 text-center text-xs sm:text-sm font-bold text-foreground">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(current + 1, product.stock || current + 1))}
                    className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground"
                    disabled={isOutOfStock}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>

              {stockMessage ? (
                <p className={cn("mt-2 text-xs sm:text-sm font-medium", stockMessageTone === "destructive" ? "text-destructive" : "text-amber-600")}>{stockMessage}</p>
              ) : null}
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-1 sm:pt-2">
              {product.isPreOrder ? (
                <a
                  href={`tel:${STORE_PHONE}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold transition-all duration-200 shadow-md bg-primary text-white hover:bg-primary/90"
                >
                  <PhoneCall className="h-4 w-4" />
                  Call & Customize
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isOutOfStock}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold transition-all duration-200 shadow-md",
                    isOutOfStock
                      ? "cursor-not-allowed bg-muted text-muted-foreground"
                      : "bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  <ShoppingBag className="h-4 w-4" />
                  {isOutOfStock ? "Out of Stock" : confirmLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}