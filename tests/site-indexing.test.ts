import { test } from "node:test";
import assert from "node:assert/strict";
import { indexingEnabled, siteOrigin } from "../lib/site-indexing";

test("indexing is opt-in and origin normalization strips paths", () => {
  const previousIndexing = process.env.SITE_INDEXING_ENABLED;
  const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
  try {
    delete process.env.SITE_INDEXING_ENABLED;
    assert.equal(indexingEnabled(), false);
    process.env.NEXT_PUBLIC_APP_URL = "https://shop.example/stale-path";
    assert.equal(siteOrigin(), "https://shop.example");
  } finally {
    if (previousIndexing === undefined) delete process.env.SITE_INDEXING_ENABLED; else process.env.SITE_INDEXING_ENABLED = previousIndexing;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
  }
});
