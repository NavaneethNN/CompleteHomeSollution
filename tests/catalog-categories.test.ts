import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let categories: unknown[] = [];
let unavailable = false;
require.cache[require.resolve("../lib/db")] = { exports: { db: {
  category: { findMany: async () => {
    if (unavailable) throw new Error("Database unavailable");
    return categories;
  } },
} } } as NodeModule;
require.cache[require.resolve("../auth")] = { exports: { auth: async () => null } } as NodeModule;
const { GET } = require("../app/api/categories/route");

test("a fresh catalog returns no invented categories", async () => {
  categories = [];
  const response = await GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [] });
});

test("catalog navigation returns only stored categories", async () => {
  categories = [{ id: "real-category", name: "Living", slug: "living" }];
  const response = await GET();
  assert.deepEqual(await response.json(), { data: categories });
});

test("database failures return unavailable instead of demo categories", async t => {
  unavailable = true;
  t.after(() => { unavailable = false; });
  t.mock.method(console, "error", () => {});
  const response = await GET();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Categories are temporarily unavailable." });
});
