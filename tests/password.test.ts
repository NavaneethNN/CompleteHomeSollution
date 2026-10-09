import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "../lib/password";

test("new passwords use versioned scrypt and malformed hashes fail safely", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.match(stored, /^scrypt-v1\$131072\$8\$1\$/);
  assert.equal(passwordNeedsRehash(stored), false);
  assert.equal(await verifyPassword("correct horse battery staple", stored), true);
  assert.equal(await verifyPassword("wrong", stored), false);
  for (const malformed of ["", "scrypt-v1$bad", "not:a:hash", "scrypt-v2$131072$8$1$x$y"]) {
    assert.equal(await verifyPassword("password", malformed), false);
  }
});

test("legacy SHA-256 credentials authenticate and are marked for migration", async () => {
  const salt = "0123456789abcdef0123456789abcdef";
  const password = "legacy-password";
  const legacy = `${salt}:${createHash("sha256").update(salt + password).digest("hex")}`;
  assert.equal(await verifyPassword(password, legacy), true);
  assert.equal(await verifyPassword("wrong", legacy), false);
  assert.equal(passwordNeedsRehash(legacy), true);
});
