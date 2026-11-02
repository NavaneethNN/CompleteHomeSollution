import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateEstimatedMinimumDimensions,
  selectPackagingPreset,
  type PackagingItemInput,
} from "../lib/packaging";
import { buildPackagedParcelGroups } from "../lib/shipping-packages";

test("calculateEstimatedMinimumDimensions computes envelope and volume for multiple items", () => {
  const items: PackagingItemInput[] = [
    { name: "Item A", quantity: 2, weight: 1.5, length: 30, width: 20, height: 10 },
    { name: "Item B", quantity: 1, weight: 2.0, length: 25, width: 25, height: 15 },
  ];

  const result = calculateEstimatedMinimumDimensions(items);

  assert.equal(result.isAutoEstimated, true);
  assert.equal(result.productWeight, 5.0);
  assert.ok(result.packedWeight >= 5.2);
  assert.ok(result.length >= 30, `Length ${result.length} should be at least max item length 30`);
  assert.ok(result.width >= 25, `Width ${result.width} should be at least max item width 25`);
  assert.ok(result.height >= 15, `Height ${result.height} should be at least max item height 15`);
  // Total volume must accommodate items volume
  const totalItemVolume = 2 * (30 * 20 * 10) + (25 * 25 * 15);
  const boxVolume = result.length * result.width * result.height;
  assert.ok(boxVolume >= totalItemVolume, `Box volume ${boxVolume} must be >= items volume ${totalItemVolume}`);
});

test("selectPackagingPreset with no configured presets returns estimated minimum for multiple items", async () => {
  const items: PackagingItemInput[] = [
    { name: "Vase 1", quantity: 1, weight: 2.0, length: 30, width: 20, height: 20 },
    { name: "Vase 2", quantity: 1, weight: 2.0, length: 30, width: 20, height: 20 },
  ];

  // Pass empty presets array to simulate no presets configured in database
  const result = await selectPackagingPreset(items, []);

  assert.ok(result !== null);
  assert.equal(result.isAutoEstimated, true);
  assert.ok(result.packageName.includes("Estimated Minimum"));
  assert.equal(result.productWeight, 4.0);
  assert.ok(result.length >= 30);
  assert.ok(result.width >= 20);
  assert.ok(result.height >= 20);
});

test("selectPackagingPreset with no configured presets returns null for a single item (uses product dimensions)", async () => {
  const singleItem: PackagingItemInput[] = [
    { name: "Single Vase", quantity: 1, weight: 2.0, length: 30, width: 20, height: 20 },
  ];

  // Single item with no preset in DB should return null so it uses product dimensions directly
  const result = await selectPackagingPreset(singleItem, []);

  assert.equal(result, null);
});

test("buildPackagedParcelGroups bundles multiple items into 1 package when no presets configured", async () => {
  const shippingItems = [
    { key: "item-1:base", quantity: 2, weight: 1.0, length: 25, width: 20, height: 10, requiresPackaging: true },
    { key: "item-2:base", quantity: 1, weight: 1.5, length: 20, width: 15, height: 15, requiresPackaging: true },
  ];

  const { groups, packaging } = await buildPackagedParcelGroups(shippingItems);

  // If presets exist in DB or not, it should bundle into 1 package (count: 1)
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 1);
  assert.ok(groups[0].weightKg >= 3.5);
  assert.ok(packaging !== null);
});
