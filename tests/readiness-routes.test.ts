import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

const require = createRequire(import.meta.url);
let session: { user: { id: string; role: string } } | null = null;
let storedRole = "CUSTOMER";
let qaWrites = 0;

const db = {
  user: {
    findUnique: async () => session ? { role: storedRole } : null,
  },
  testResult: {
    findMany: async () => [],
    upsert: async ({ create }: { create: unknown }) => { qaWrites++; return create; },
  },
};

function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}

stub("../auth", { auth: async () => session });
stub("../lib/db", { db });

const qa = require("../app/api/qa/results/route") as typeof import("../app/api/qa/results/route");

function qaRequest(body: unknown) {
  return new NextRequest("https://shop.example/api/qa/results", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("QA reads and writes require an administrator and validate writes", async () => {
  qaWrites = 0;
  session = null;
  storedRole = "CUSTOMER";
  assert.equal((await qa.GET(new NextRequest("https://shop.example/api/qa/results"))).status, 403);
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED" }))).status, 403);

  session = { user: { id: "customer", role: "CUSTOMER" } };
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED" }))).status, 403);

  session = { user: { id: "admin", role: "ADMIN" } };
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED" }))).status, 403);
  storedRole = "ADMIN";
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "NOT_A_STATUS" }))).status, 400);
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED", unexpected: true }))).status, 400);
  assert.equal((await qa.PUT(qaRequest({ testId: "x", suite: "s", status: "PASSED" }))).status, 200);
  assert.equal(qaWrites, 1);
});
