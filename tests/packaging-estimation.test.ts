import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPackagedParcelGroups, resolveOrderShipmentBoxes } from "../lib/shipping-packages";

test("buildPackagedParcelGroups uses exact product/variant dimensions directly without auto-box preset wrapping", async () => {
  const shippingItems = [
    {
      key: "item-1:base",
      label: "Ceramic Bowl",
      quantity: 2,
      weight: 1.5,
      length: 30,
      width: 20,
      height: 10,
      requiresPackaging: true,
    },
    {
      key: "item-2:base",
      label: "Table Lamp",
      quantity: 1,
      weight: 2.0,
      length: 25,
      width: 25,
      height: 15,
      requiresPackaging: false,
    },
  ];

  // Even when a legacy preset array is passed, no preset wrapping or same-box estimation occurs
  const legacyPresets = [
    { id: "preset-big", name: "Big Outer Carton", length: 80, width: 60, height: 50, maxWeight: 30, emptyWeight: 1.2 },
  ];
  const { groups, boxes, packaging } = await buildPackagedParcelGroups(shippingItems, legacyPresets);

  assert.equal(groups.reduce((sum, g) => sum + g.count, 0), 3);
  assert.equal(boxes.length, 2);
  assert.deepEqual(boxes[0], {
    label: "Ceramic Bowl",
    quantity: 2,
    length: 30,
    width: 20,
    height: 10,
    weight: 1.5,
  });
  assert.deepEqual(boxes[1], {
    label: "Table Lamp",
    quantity: 1,
    length: 25,
    width: 25,
    height: 15,
    weight: 2.0,
  });
  assert.ok(packaging !== null);
  assert.equal(packaging.presetId, null);
  assert.equal(packaging.packedWeight, 5.0);
  assert.match(packaging.packageName, /3 Boxes/i);
});

test("buildPackagedParcelGroups handles every product unit and multi-box product in separate boxes (never bundles together)", async () => {
  const shippingItems = [
    {
      key: "item-1:base",
      label: "Dining Table",
      quantity: 2,
      weight: 12.0,
      length: 120,
      width: 60,
      height: 15,
      requiresPackaging: true,
      extraPackages: [{ weight: 8.0, length: 70, width: 40, height: 15 }],
    },
    {
      key: "item-2:base",
      label: "Side Chair",
      quantity: 1,
      weight: 6.5,
      length: 50,
      width: 50,
      height: 45,
      requiresPackaging: false,
    },
  ];

  const { groups, boxes, packaging } = await buildPackagedParcelGroups(shippingItems);

  // Dining Table has 2 boxes per unit * qty 2 = 4 boxes; Side Chair has 1 box * qty 1 = 1 box => 5 separate boxes
  const totalParcelCount = groups.reduce((sum, g) => sum + g.count, 0);
  assert.equal(totalParcelCount, 5);
  assert.equal(groups.length, 3);
  assert.equal(boxes.length, 3);
  assert.ok(packaging !== null);
  assert.equal(packaging.packedWeight, 46.5); // 2 * (12 + 8) + 6.5
  assert.match(packaging.packageName, /5 Boxes/i);
});

test("resolveOrderShipmentBoxes keeps multi-product order boxes separate without DB preset queries", async () => {
  const resolved = await resolveOrderShipmentBoxes({
    items: [
      {
        id: "oi-a",
        quantity: 2,
        product: {
          weight: 5,
          length: 40,
          width: 30,
          height: 20,
          extraPackages: [{ weight: 3, length: 30, width: 20, height: 15 }],
          name: "Modular Bookcase",
        },
        productVariant: null,
      },
      {
        id: "oi-b",
        quantity: 1,
        product: {
          weight: 2.5,
          length: 25,
          width: 20,
          height: 12,
          name: "Desk Organizer",
        },
        productVariant: null,
      },
    ],
  });

  assert.equal(resolved.packagePresetId, null);
  assert.equal(resolved.totalBoxCount, 5);
  assert.equal(resolved.boxes.length, 3);
  assert.equal(resolved.packedWeight, 18.5); // 2*(5+3) + 2.5
});
