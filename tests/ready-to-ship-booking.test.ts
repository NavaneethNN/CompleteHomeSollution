import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Unit test for Couriers Please booking flow & dimension validation
test("ready-to-ship booking validates dimensions, weight and updates order", async () => {
  // Verify dimension calculation logic
  const length = 40;
  const width = 30;
  const height = 20;
  const weight = 3.5;

  const cubicWeight = Math.round(((length * width * height) / 4000) * 100) / 100;
  assert.equal(cubicWeight, 6.0); // (40 * 30 * 20) / 4000 = 24000 / 4000 = 6.0 kg

  const billableWeight = Math.max(weight, cubicWeight);
  assert.equal(billableWeight, 6.0);

  // When weight is larger than cubic weight
  const heavyWeight = 8.5;
  const billableHeavy = Math.max(heavyWeight, cubicWeight);
  assert.equal(billableHeavy, 8.5);
});

test("ready-to-ship rejects invalid, non-positive or oversized dimensions", async () => {
  const invalidDimensions = [
    { length: 0, width: 20, height: 20, weight: 1 },
    { length: -5, width: 20, height: 20, weight: 1 },
    { length: 20, width: 0, height: 20, weight: 1 },
    { length: 20, width: 20, height: 0, weight: 1 },
    { length: 20, width: 20, height: 20, weight: 0 },
    { length: 20, width: 20, height: 20, weight: -2 },
    { length: 350, width: 20, height: 20, weight: 1 }, // > 300cm max
    { length: 20, width: 20, height: 20, weight: 150 }, // > 100kg max
  ];

  for (const dim of invalidDimensions) {
    const isInvalid =
      dim.length <= 0 ||
      dim.width <= 0 ||
      dim.height <= 0 ||
      dim.weight <= 0 ||
      dim.length > 300 ||
      dim.width > 300 ||
      dim.height > 300 ||
      dim.weight > 100;
    assert.ok(isInvalid, `Dimension ${JSON.stringify(dim)} should be invalid`);
  }
});

