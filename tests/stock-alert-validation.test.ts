import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
require.cache[require.resolve("../lib/db")] = { exports: { db: {} } } as NodeModule;
const { POST } = require("../app/api/stock-alerts/route") as typeof import("../app/api/stock-alerts/route");

test("stock alerts classify malformed and invalid requests as client errors", async () => {
  const malformed = new NextRequest("https://shop.example/api/stock-alerts", { method: "POST", body: "{broken" });
  assert.equal((await POST(malformed)).status, 400);
  const invalid = new NextRequest("https://shop.example/api/stock-alerts", { method: "POST", body: JSON.stringify({}) });
  assert.equal((await POST(invalid)).status, 400);
});
