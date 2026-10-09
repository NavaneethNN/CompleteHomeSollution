import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let missingTable = "";
let redisDown = false;
const queried: string[] = [];
const tables = ["order", "membershipPayment", "membershipPlan", "coupon", "stockAlert", "emailJob"];
const db = Object.fromEntries(tables.map(table => [table, { findFirst: async () => {
  queried.push(table);
  if (missingTable === table) throw new Error("Missing migration column: private database details");
  return null;
} }]));
require.cache[require.resolve("../lib/db")] = { exports: { db } } as NodeModule;
require.cache[require.resolve("@upstash/redis")] = { exports: { Redis: class {
  async ping() { if (redisDown) throw new Error("Secret provider details"); return "PONG"; }
} } } as NodeModule;
const { GET } = require("../app/api/health/route") as typeof import("../app/api/health/route");

test("readiness requires migrated tables and an available shared limiter without exposing details", async t => {
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL, oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
  });
  process.env.UPSTASH_REDIS_REST_URL = "https://example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  assert.equal((await GET()).status, 200);
  assert.deepEqual(new Set(queried), new Set(tables));
  for (const table of tables) {
    missingTable = table;
    const response = await GET();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unavailable" });
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  missingTable = "";
  redisDown = true;
  assert.equal((await GET()).status, 503);
  redisDown = false;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal((await GET()).status, 503);
});
