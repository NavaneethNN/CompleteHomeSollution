import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { imageUploadError, MAX_IMAGE_UPLOAD_BYTES, uploadStorageConfigurationError } from "../lib/upload-policy";

const require = createRequire(import.meta.url);
let session: { user: { id: string; role: string } } | null = { user: { id: "admin", role: "ADMIN" } };
let uploads = 0;
let storageError: Error | null = null;
require.cache[require.resolve("../auth")] = { exports: { auth: async () => session } } as NodeModule;
require.cache[require.resolve("../lib/rate-limit")] = { exports: {
  consumeRateLimit: async () => ({ allowed: true }), getClientIp: () => "test",
} } as NodeModule;
require.cache[require.resolve("../lib/r2")] = { exports: {
  r2: { send: async () => { uploads++; if (storageError) throw storageError; } },
  generateImageKey: () => "categories/test.png", getPublicUrl: () => "https://images.example/categories/test.png",
} } as NodeModule;
const { POST } = require("../app/api/upload/route");
const validEnv = { R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "test", R2_SECRET_ACCESS_KEY: "test", R2_BUCKET_NAME: "images", R2_PUBLIC_URL: "https://images.example" };

function request(file: File | string = new File(["image"], "test.png", { type: "image/png" })) {
  const body = new FormData();
  body.set("folder", "categories"); body.set("file", file);
  return new NextRequest("https://shop.example/api/upload", { method: "POST", body });
}

test("image validation accepts the safe limit and rejects oversized, empty, and unsupported files", () => {
  assert.equal(imageUploadError({ size: MAX_IMAGE_UPLOAD_BYTES, type: "image/png" }), null);
  assert.match(imageUploadError({ size: MAX_IMAGE_UPLOAD_BYTES + 1, type: "image/png" })!, /4 MB/);
  assert.match(imageUploadError({ size: 0, type: "image/png" })!, /empty/);
  assert.ok(imageUploadError({ size: 10, type: "text/html" }));
});

test("storage requires credentials and a usable public URL", () => {
  assert.equal(uploadStorageConfigurationError(validEnv), null);
  assert.match(uploadStorageConfigurationError({})!, /R2_PUBLIC_URL/);
  assert.match(uploadStorageConfigurationError({ ...validEnv, R2_PUBLIC_URL: "https://test.r2.cloudflarestorage.com/images" })!, /not the R2 storage API/);
});

test("upload route validates access and file payload before storage", async t => {
  const original = session; t.after(() => { session = original; });
  uploads = 0;
  session = null;
  assert.equal((await POST(request())).status, 401);
  session = { user: { id: "customer", role: "CUSTOMER" } };
  assert.equal((await POST(request())).status, 403);
  session = original;
  assert.equal((await POST(request("not-a-file"))).status, 400);
  assert.equal((await POST(request(new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], "large.png", { type: "image/png" })))).status, 413);
  assert.equal(uploads, 0);
});

test("upload route reports storage configuration and provider failures without leaking secrets", async t => {
  for (const [key, value] of Object.entries(validEnv)) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  t.mock.method(console, "error", () => {});
  t.after(() => { storageError = null; });
  delete process.env.R2_PUBLIC_URL;
  const missing = await POST(request());
  assert.equal(missing.status, 503);
  assert.match((await missing.json()).error, /R2_PUBLIC_URL/);
  process.env.R2_PUBLIC_URL = validEnv.R2_PUBLIC_URL;
  storageError = Object.assign(new Error("sensitive provider diagnostics"), { name: "AccessDenied" });
  const denied = await POST(request());
  assert.equal(denied.status, 502);
  const message = (await denied.json()).error;
  assert.match(message, /write permissions/);
  assert.doesNotMatch(message, /sensitive/);
  storageError = new Error("Unauthorized");
  const unauthorized = await POST(request());
  assert.equal(unauthorized.status, 502);
  assert.match((await unauthorized.json()).error, /R2 access keys/);
  storageError = null;
  const success = await POST(request());
  assert.equal(success.status, 200);
  assert.equal((await success.json()).publicUrl, "https://images.example/categories/test.png");
});
