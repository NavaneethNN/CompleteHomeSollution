import { test } from "node:test";
import assert from "node:assert/strict";
import { publishedBlogWhere } from "../lib/blog-publication";

test("public blog predicate requires published state and a reached publication date", () => {
  const now = new Date("2026-09-24T00:00:00.000Z");
  assert.deepEqual(publishedBlogWhere(now), {
    status: "PUBLISHED",
    publishedAt: { lte: now },
  });
});
