import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
const productId = "c1234567890123456789012345";
const variantId = "c1234567890123456789012346";
let variantMemberPrice: number | null = 95;
const db = { product: { findMany: async () => [{
  id: productId, name: "Current chair", slug: "current-chair", sku: "CHAIR", images: ["/chair.jpg"], hasVariants: true,
  basePrice: 80, memberPrice: 70, stock: 0, weight: 4,
  productVariants: [{ id: variantId, sku: "CHAIR-BLUE", price: 120, memberPrice: variantMemberPrice, stock: 2, weight: 4,
    values: [{ variantValue: { value: "Blue", variantAttribute: { name: "Colour" } } }] }],
}] } };
require.cache[require.resolve("../lib/db")] = { exports: { db } } as NodeModule;
const { POST } = require("../app/api/cart/products/route") as typeof import("../app/api/cart/products/route");

function request(body: unknown) {
  return new NextRequest("https://shop.example/api/cart/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("cart catalog returns current variant price, stock and identity without a fabricated base variant", async () => {
  const response = await POST(request({ ids: [productId] }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.catalog[variantId].price, 120);
  assert.equal(body.catalog[variantId].memberPrice, 95);
  assert.equal(body.catalog[variantId].stock, 2);
  assert.equal(body.catalog[variantId].variantLabel, "Colour: Blue");
  assert.equal(body.catalog[productId], undefined);
});

test("cart catalog inherits the product member price for variants without an override", async () => {
  variantMemberPrice = null;
  try {
    const response = await POST(request({ ids: [productId] }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.catalog[variantId].memberPrice, 70);
    assert.equal(body.prices[variantId].memberPrice, 70);
  } finally {
    variantMemberPrice = 95;
  }
});

test("cart catalog rejects malformed requests", async () => {
  assert.equal((await POST(request({ ids: ["invalid"] }))).status, 400);
  assert.equal((await POST(request({ ids: [] }))).status, 400);
});
