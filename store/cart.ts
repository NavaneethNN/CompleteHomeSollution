import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  memberPrice?: number | null;
  images: string[];
  stock: number;
  description?: string;
  variantId?: string | null;
  variantLabel?: string;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: CartProduct, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: (isMember?: boolean) => number;
  getItemQuantity: (productId: string, variantId?: string | null) => number;
  isInCart: (productId: string, variantId?: string | null) => boolean;
}

const getCartItemKey = (productId: string, variantId?: string | null) =>
  `${productId}:${variantId ?? "default"}`;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1) => {
        set((state) => {
          const key = getCartItemKey(product.id, product.variantId ?? null);
          const existing = state.items.find(
            (item) => getCartItemKey(item.product.id, item.product.variantId ?? null) === key
          );

          if (existing) {
            return {
              items: state.items.map((item) =>
                getCartItemKey(item.product.id, item.product.variantId ?? null) === key
                  ? {
                      ...item,
                      quantity: Math.min(item.quantity + quantity, item.product.stock),
                    }
                  : item
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                product: {
                  ...product,
                  variantId: product.variantId ?? null,
                },
                quantity: Math.min(quantity, product.stock),
              },
            ],
          };
        });
      },

      removeItem: (productId, variantId = null) => {
        set((state) => ({
          items: state.items.filter(
            (item) =>
              getCartItemKey(item.product.id, item.product.variantId ?? null) !==
              getCartItemKey(productId, variantId)
          ),
        }));
      },

      updateQuantity: (productId, quantity, variantId = null) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            getCartItemKey(item.product.id, item.product.variantId ?? null) ===
            getCartItemKey(productId, variantId)
              ? { ...item, quantity: Math.min(quantity, item.product.stock) }
              : item
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () =>
        get().items.reduce((total, item) => total + item.quantity, 0),

      getSubtotal: (isMember = false) =>
        get().items.reduce((total, item) => {
          const price =
            isMember && item.product.memberPrice
              ? item.product.memberPrice
              : item.product.price;
          return total + price * item.quantity;
        }, 0),

      getItemQuantity: (productId, variantId = null) =>
        get().items.find(
          (item) =>
            getCartItemKey(item.product.id, item.product.variantId ?? null) ===
            getCartItemKey(productId, variantId)
        )?.quantity ?? 0,

      isInCart: (productId, variantId = null) =>
        get().getItemQuantity(productId, variantId) > 0,
    }),
    {
      name: "chs-cart",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
