import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface WishlistCategory {
  name: string;
  slug: string;
}

export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number | null;
  memberPrice?: number | null;
  images: string[];
  stock: number;
  description?: string;
  material?: string | null;
  category: WishlistCategory;
  variantId?: string | null;
  variantLabel?: string;
}

interface WishlistState {
  items: WishlistProduct[];
  addItem: (product: WishlistProduct) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  toggleItem: (product: WishlistProduct) => void;
  clearWishlist: () => void;
  getCount: () => number;
  isInWishlist: (productId: string, variantId?: string | null) => boolean;
}

const getWishlistItemKey = (productId: string, variantId?: string | null) =>
  `${productId}:${variantId ?? "default"}`;

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        set((state) => {
          const key = getWishlistItemKey(product.id, product.variantId ?? null);
          const exists = state.items.some(
            (item) => getWishlistItemKey(item.id, item.variantId ?? null) === key
          );

          if (exists) {
            return state;
          }

          return {
            items: [{ ...product, variantId: product.variantId ?? null }, ...state.items],
          };
        });
      },

      removeItem: (productId, variantId = null) => {
        set((state) => ({
          items: state.items.filter(
            (item) =>
              getWishlistItemKey(item.id, item.variantId ?? null) !==
              getWishlistItemKey(productId, variantId)
          ),
        }));
      },

      toggleItem: (product) => {
        const key = getWishlistItemKey(product.id, product.variantId ?? null);
        const exists = get().items.some(
          (item) => getWishlistItemKey(item.id, item.variantId ?? null) === key
        );

        if (exists) {
          get().removeItem(product.id, product.variantId ?? null);
          return;
        }

        get().addItem(product);
      },

      clearWishlist: () => set({ items: [] }),

      getCount: () => get().items.length,

      isInWishlist: (productId, variantId = null) =>
        get().items.some(
          (item) =>
            getWishlistItemKey(item.id, item.variantId ?? null) ===
            getWishlistItemKey(productId, variantId)
        ),
    }),
    {
      name: "chs-wishlist",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
