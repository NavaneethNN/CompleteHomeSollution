import { test } from "node:test";
import assert from "node:assert/strict";

test("cart rejects invalid quantities and keeps variants separate", async () => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) } });
  const { useCartStore } = await import("../store/cart");
  const store = useCartStore.getState();
  store.clearCart();
  const product = { id: "product1", name: "Chair", slug: "chair", price: 10, images: [], stock: 2 };
  store.addItem(product, 0);
  store.addItem(product, 1.5);
  store.addItem({ ...product, stock: 0 });
  assert.equal(useCartStore.getState().items.length, 0);
  store.addItem({ ...product, variantId: "red" }, 2);
  store.addItem({ ...product, variantId: "blue" }, 1);
  store.addItem({ ...product, variantId: "red" }, 1);
  assert.equal(store.getItemQuantity(product.id, "red"), 2);
  store.addItem({ ...product, variantId: "red", price: 12, stock: 1 }, 1);
  assert.equal(store.getItemQuantity(product.id, "red"), 1);
  assert.equal(useCartStore.getState().items.find(item => item.product.variantId === "red")?.product.price, 12);
  assert.equal(store.getItemQuantity(product.id, "blue"), 1);
  store.updateQuantity(product.id, NaN, "red");
  assert.equal(store.getItemQuantity(product.id, "red"), 1);
  store.updateQuantity(product.id, 0, "red");
  assert.equal(store.getItemQuantity(product.id, "red"), 0);
  assert.equal(store.getItemQuantity(product.id, "blue"), 1);
  store.clearCart();
});
