import { test } from "node:test";
import assert from "node:assert/strict";
import { buildParcelGroups, FreightRequiredError, shipmentKey } from "../lib/shipping-packages";

test("shipping uses every quantity and groups identical real packages", () => {
  const groups = buildParcelGroups([
    { key: "chair", quantity: 25, weight: 4.5, length: 40, width: 30, height: 20 },
    { key: "lamp", quantity: 2, weight: 1, length: 20, width: 15, height: 10 },
  ]);
  assert.equal(groups.reduce((sum, group) => sum + group.count, 0), 27);
  assert.equal(groups.find(group => group.weightKg === 4.5)?.count, 25);
  assert.equal(shipmentKey(groups), shipmentKey(structuredClone(groups)));
});

test("unknown or implausible packages require manual freight; Ship123 evaluates larger furniture", () => {
  const base = { key: "sofa", quantity: 1, weight: 10, length: 80, width: 30, height: 20 };
  assert.throws(() => buildParcelGroups([{ ...base, weight: null }]), FreightRequiredError);
  assert.equal(buildParcelGroups([{ ...base, weight: 22.1, length: 106 }])[0].weightKg, 22.1);
  assert.throws(() => buildParcelGroups([{ ...base, weight: 1001 }]), FreightRequiredError);
  assert.throws(() => buildParcelGroups([{ ...base, length: 1001 }]), FreightRequiredError);
});
