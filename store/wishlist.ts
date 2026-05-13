import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  stock: number;
  description?: string;
  memberPrice?: number | null;
  comparePrice?: number | null;
  variantId?: string | null;
  variantLabel?: string;
}

interface WishlistState {
  items: WishlistProduct[];
  addItem: (product: WishlistProduct) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  isInWishlist: (productId: string, variantId?: string | null) => boolean;
  clearWishlist: () => void;
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
          const alreadyExists = state.items.some(
            (item) => getWishlistItemKey(item.id, item.variantId ?? null) === key
          );

          if (alreadyExists) {
            return state;
          }

          return {
            items: [...state.items, { ...product, variantId: product.variantId ?? null }],
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

      isInWishlist: (productId, variantId = null) =>
        get().items.some(
          (item) =>
            getWishlistItemKey(item.id, item.variantId ?? null) ===
            getWishlistItemKey(productId, variantId)
        ),

      clearWishlist: () => set({ items: [] }),
    }),
    {
      name: "chs-wishlist",
      storage: createJSONStorage(() => localStorage),
    }
  )
);