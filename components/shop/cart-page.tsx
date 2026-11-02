"use client";

import Link from "next/link";
import { ShoppingBag, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCartStore, type CartProduct } from "@/store/cart";
import { CartItem } from "./cart-item";
import { CartSummary } from "./cart-summary";
import { CartUpsell } from "./cart-upsell";

interface CartPageProps {
  isMember?: boolean;
}

const emptyStateActions = [
  { label: "Continue Shopping", href: "/products" },
  { label: "Browse Categories", href: "/categories/living-room" },
];

export function CartPage({ isMember = false }: CartPageProps) {
  const [isMounted, setIsMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const [catalog, setCatalog] = useState<Record<string, CartProduct>>({});
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const productIds = useMemo(() => {
    return JSON.stringify([...new Set(items.map((item) => item.product.id))]);
  }, [items]);

  useEffect(() => {
    if (!isMounted || productIds === "[]") return;
    const controller = new AbortController();
    setRefreshState("loading");

    fetch("/api/cart/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: JSON.parse(productIds) }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog refresh failed");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setCatalog(data.catalog || {});
          setRefreshState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setRefreshState("error");
      });

    return () => controller.abort();
  }, [productIds, isMounted]);

  // Keep stored product details as fallback so cart renders in 0ms without waiting for network
  const currentItems = useMemo(
    () =>
      items.map((item) => {
        const current = catalog[item.product.variantId ?? item.product.id];
        if (current && current.id === item.product.id) {
          return { ...item, product: current };
        }
        return item;
      }),
    [items, catalog]
  );

  const unavailable =
    refreshState === "ready" && currentItems.some((item) => item.product.stock < item.quantity);

  const priceChanged =
    refreshState === "ready" &&
    currentItems.some(
      (item, index) =>
        item.product.stock > 0 &&
        (item.product.price !== items[index]?.product.price ||
          item.product.memberPrice !== items[index]?.product.memberPrice)
    );

  const subtotal = useMemo(
    () =>
      currentItems.reduce((total, item) => {
        if (item.product.stock <= 0) return total;
        const basePrice = Math.max(0, item.product.price ?? 0);
        const memberPrice =
          item.product.memberPrice && item.product.memberPrice > 0 ? item.product.memberPrice : null;
        const effectivePrice = isMember && memberPrice !== null ? memberPrice : basePrice;
        return total + effectivePrice * item.quantity;
      }, 0),
    [currentItems, isMember]
  );

  const fullSubtotal = useMemo(
    () =>
      currentItems.reduce(
        (total, item) =>
          total + (item.product.stock > 0 ? Math.max(0, item.product.price ?? 0) * item.quantity : 0),
        0
      ),
    [currentItems]
  );

  const memberSavings = isMember ? fullSubtotal - subtotal : 0;
  const totalItemCount = items.reduce((t, i) => t + i.quantity, 0);

  // Before client hydration, render skeleton to prevent flashing empty cart state
  if (!isMounted) {
    return (
      <main className="bg-background py-8 md:py-12 animate-pulse">
        <div className="container mx-auto px-4 md:px-6 xl:px-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="h-7 w-40 bg-stone-200 rounded-lg" />
              <div className="h-4 w-20 bg-stone-100 rounded" />
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <section className="min-w-0 space-y-3 sm:space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-border bg-white p-3 sm:gap-4 sm:p-4">
                  <div className="h-20 w-20 rounded-lg bg-stone-200 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div className="h-4 w-3/4 bg-stone-200 rounded" />
                    <div className="h-5 w-16 bg-stone-200 rounded" />
                  </div>
                </div>
              ))}
            </section>
            <div className="h-64 rounded-xl border border-border bg-white p-4" />
          </div>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="bg-background py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 xl:px-8">
          <div className="mx-auto max-w-3xl rounded-2xl sm:rounded-[2rem] border border-border bg-white p-5 text-center shadow-sm sm:p-8 md:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-2xl font-black text-foreground sm:text-3xl md:text-4xl">Your cart is empty</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Add items to your cart from the product listing or product page to start building your order.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {emptyStateActions.map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={
                    index === 0
                      ? "inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary/90"
                      : "inline-flex items-center justify-center rounded-xl border-2 border-foreground px-6 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-foreground hover:text-white"
                  }
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-6 xl:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Shopping Cart</h1>
              {refreshState === "loading" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-normal">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  Updating prices…
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCart}
            className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline transition-colors"
          >
            Clear all
          </button>
        </div>

        {refreshState === "error" && (
          <div role="status" className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Live catalog sync is temporarily taking longer than expected. Showing your saved cart prices.
          </div>
        )}
        {priceChanged && (
          <div role="status" className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            Prices have been updated to current catalog rates.
          </div>
        )}
        {unavailable && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 font-medium">
            One or more items are unavailable or exceed current stock. Remove them or reduce their quantity before checkout.
          </div>
        )}

        <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="min-w-0 space-y-3 sm:space-y-4">
            {currentItems.map((item, index) => {
              const itemKey = `${item.product.id ?? "unknown"}-${item.product.variantId ?? "default"}-${index}`;
              return (
                <CartItem
                  key={itemKey}
                  item={item}
                  isMember={isMember}
                  onUpdateQuantity={(quantity) =>
                    updateQuantity(item.product.id, quantity, item.product.variantId ?? null)
                  }
                  onRemove={() => removeItem(item.product.id, item.product.variantId ?? null)}
                />
              );
            })}
          </section>

          <div className="space-y-4">
            <CartSummary
              subtotal={subtotal}
              itemCount={totalItemCount}
              isMember={isMember}
              memberSavings={memberSavings}
              canCheckout={!unavailable}
            />
            <CartUpsell isMember={isMember} />
          </div>
        </div>
      </div>
    </main>
  );
}

