import assert from "node:assert/strict";
import test from "node:test";
import { reconciliationDelayMinutes } from "../lib/reconciliation";

test("reconciliation backoff grows and remains bounded", () => {
  assert.equal(reconciliationDelayMinutes(0), 1);
  assert.equal(reconciliationDelayMinutes(1), 2);
  assert.equal(reconciliationDelayMinutes(5), 32);
  assert.equal(reconciliationDelayMinutes(20), 360);
});
