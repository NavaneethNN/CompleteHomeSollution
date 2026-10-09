import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const root = process.cwd();

test("audited public destinations exist and registration uses canonical policy links", () => {
  for (const route of ["categories", "contact", "terms-of-service", "privacy-policy"]) {
    assert.equal(existsSync(join(root, "app/(shop)", route, "page.tsx")), true, `missing /${route}`);
  }
  const registration = readFileSync(join(root, "app/(auth)/register/_components/register-form.tsx"), "utf8");
  assert.match(registration, /href="\/terms-of-service"/);
  assert.match(registration, /href="\/privacy-policy"/);
  assert.doesNotMatch(registration, /href="\/(terms|privacy)"/);
});
