"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingBag } from "lucide-react";
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
      <DialogContent className="max-w-4xl overflow-hidden border-border bg-white p-0 sm:rounded-[28px]">
        <div className="grid md:grid-cols-[0.92fr_1.08fr]">
          <div className="relative min-h-[260px] bg-muted md:min-h-[520px]">
            <Image
              src={image}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 45vw"
            />
          </div>

          <div className="flex flex-col gap-5 p-5 md:p-8">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                {product.name}
              </DialogTitle>
              <DialogDescription className="text-sm md:text-base text-muted-foreground leading-relaxed">
                {product.description ?? "Review the product details and choose your quantity before adding it to your cart."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-foreground">
                  ${unitPrice.toLocaleString()}
                </span>
                {memberPrice ? (
                  <span className="text-sm text-primary font-semibold">
                    Member: ${memberPrice.toLocaleString()}
                  </span>
                ) : null}
              </div>

              {product.variantLabel ? (
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {product.variantLabel}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Quantity</p>
                  <p className="text-xs text-muted-foreground">Default quantity starts at 1.</p>
                </div>
                <div className="flex items-center rounded-xl border border-border bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground"
                    disabled={isOutOfStock}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-12 px-3 text-center text-sm font-bold text-foreground">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(current + 1, product.stock || current + 1))}
                    className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground"
                    disabled={isOutOfStock}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {stockMessage ? (
                <p className={cn("mt-3 text-sm font-medium", stockMessageTone === "destructive" ? "text-destructive" : "text-amber-600")}>{stockMessage}</p>
              ) : null}
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isOutOfStock}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all duration-200 shadow-md",
                  isOutOfStock
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : "bg-primary text-white hover:bg-primary/90"
                )}
              >
                <ShoppingBag className="h-4 w-4" />
                {isOutOfStock ? "Out of Stock" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}