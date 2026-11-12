import assert from "node:assert/strict";
import test from "node:test";
import {
  MEMBER_FREE_DELIVERY_CODE,
  MEMBER_FIXED_DELIVERY_CODE,
  isMemberDeliveryServiceCode,
  resolveProductMemberDeliveryMode,
  partitionCartForMemberDelivery,
  memberDeliveryShipmentKey,
  buildMemberOverriddenShipmentKey,
} from "../lib/member-delivery";
import {
  createShippingQuoteToken,
  shippingDestinationKey,
  verifyShippingQuoteToken,
} from "../lib/shipping-quote";

test("resolveProductMemberDeliveryMode gives perks exclusively to active members", () => {
  const freeProduct = { memberFreeDelivery: true, memberDeliveryCharge: null };
  const fixedProduct = { memberFreeDelivery: false, memberDeliveryCharge: 15.5 };
  const bothProduct = { memberFreeDelivery: true, memberDeliveryCharge: 10 };
  const standardProduct = { memberFreeDelivery: false, memberDeliveryCharge: null };

  // For non-members, all products resolve to STANDARD delivery
  assert.deepEqual(resolveProductMemberDeliveryMode(freeProduct, false), { type: "STANDARD" });
  assert.deepEqual(resolveProductMemberDeliveryMode(fixedProduct, false), { type: "STANDARD" });
  assert.deepEqual(resolveProductMemberDeliveryMode(bothProduct, false), { type: "STANDARD" });
  assert.deepEqual(resolveProductMemberDeliveryMode(standardProduct, false), { type: "STANDARD" });
  assert.deepEqual(resolveProductMemberDeliveryMode(null, false), { type: "STANDARD" });

  // For members, free delivery takes precedence and fixed delivery converts to cents
  assert.deepEqual(resolveProductMemberDeliveryMode(freeProduct, true), {
    type: "FREE",
    fixedUnitCents: 0,
  });
  assert.deepEqual(resolveProductMemberDeliveryMode(fixedProduct, true), {
    type: "FIXED",
    fixedUnitCents: 1550,
  });
  assert.deepEqual(resolveProductMemberDeliveryMode(bothProduct, true), {
    type: "FREE",
    fixedUnitCents: 0,
  });
  assert.deepEqual(resolveProductMemberDeliveryMode(standardProduct, true), { type: "STANDARD" });
});

test("partitionCartForMemberDelivery leaves non-member carts untouched in standardItems", () => {
  const items = [
    { productId: "p1", quantity: 2 },
    { productId: "p2", quantity: 1 },
  ];
  const products: Record<string, any> = {
    p1: { memberFreeDelivery: true },
    p2: { memberDeliveryCharge: 20 },
  };

  const partition = partitionCartForMemberDelivery(
    items,
    (item) => products[item.productId],
    false // effectiveMember = false
  );

  assert.equal(partition.allOverridden, false);
  assert.equal(partition.hasMemberDeliveryOverride, false);
  assert.equal(partition.freeCount, 0);
  assert.equal(partition.fixedLineCount, 0);
  assert.equal(partition.fixedDeliveryCents, 0);
  assert.deepEqual(partition.standardItems, items);
});

test("partitionCartForMemberDelivery partitions member carts with free delivery items", () => {
  const items = [
    { productId: "p1", quantity: 3 },
  ];
  const products: Record<string, any> = {
    p1: { memberFreeDelivery: true },
  };

  const partition = partitionCartForMemberDelivery(
    items,
    (item) => products[item.productId],
    true
  );

  assert.equal(partition.allOverridden, true);
  assert.equal(partition.hasMemberDeliveryOverride, true);
  assert.equal(partition.freeCount, 1);
  assert.equal(partition.fixedLineCount, 0);
  assert.equal(partition.fixedDeliveryCents, 0);
  assert.equal(partition.standardItems.length, 0);
});

test("partitionCartForMemberDelivery calculates fixed price * quantity across multiple fixed products", () => {
  const items = [
    { productId: "p1", quantity: 2 }, // $15 * 2 = $30
    { productId: "p2", quantity: 3 }, // $10 * 3 = $30
  ];
  const products: Record<string, any> = {
    p1: { memberDeliveryCharge: 15 },
    p2: { memberDeliveryCharge: 10 },
  };

  const partition = partitionCartForMemberDelivery(
    items,
    (item) => products[item.productId],
    true
  );

  assert.equal(partition.allOverridden, true);
  assert.equal(partition.hasMemberDeliveryOverride, true);
  assert.equal(partition.freeCount, 0);
  assert.equal(partition.fixedLineCount, 2);
  assert.equal(partition.fixedDeliveryCents, 6000); // $60.00 in cents
  assert.equal(partition.standardItems.length, 0);
});

test("partitionCartForMemberDelivery isolates standard items in mixed member carts", () => {
  const items = [
    { productId: "pFree", quantity: 1 },
    { productId: "pFixed", quantity: 2 }, // $12.50 * 2 = $25.00 (2500 cents)
    { productId: "pStd", quantity: 1 },
  ];
  const products: Record<string, any> = {
    pFree: { memberFreeDelivery: true },
    pFixed: { memberDeliveryCharge: 12.5 },
    pStd: { memberFreeDelivery: false, memberDeliveryCharge: null },
  };

  const partition = partitionCartForMemberDelivery(
    items,
    (item) => products[item.productId],
    true
  );

  assert.equal(partition.allOverridden, false);
  assert.equal(partition.hasMemberDeliveryOverride, true);
  assert.equal(partition.freeCount, 1);
  assert.equal(partition.fixedLineCount, 1);
  assert.equal(partition.fixedDeliveryCents, 2500);
  assert.equal(partition.standardItems.length, 1);
  assert.equal(partition.standardItems[0].productId, "pStd");
});

test("service codes and member shipment tokens sign and verify securely", (t) => {
  const oldSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret-for-member-delivery";
  t.after(() => {
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
  });

  assert.ok(isMemberDeliveryServiceCode(MEMBER_FREE_DELIVERY_CODE));
  assert.ok(isMemberDeliveryServiceCode(MEMBER_FIXED_DELIVERY_CODE));
  assert.ok(!isMemberDeliveryServiceCode("MANUAL_DELIVERY"));
  assert.ok(!isMemberDeliveryServiceCode("E33"));

  const items = [
    { productId: "prod_1", variantId: null, quantity: 2 },
    { productId: "prod_2", variantId: "var_a", quantity: 1 },
  ];
  const destAddress = {
    line1: "123 Collins St",
    suburb: "Melbourne",
    state: "VIC",
    postcode: "3000",
  };
  const destinationKey = shippingDestinationKey(destAddress);

  // Free delivery token ($0)
  const freeTokenKey = buildMemberOverriddenShipmentKey(items, 0);
  const freeToken = createShippingQuoteToken({
    postcode: "3000",
    destinationKey,
    shipmentKey: freeTokenKey,
    serviceCode: MEMBER_FREE_DELIVERY_CODE,
    price: 0,
  });

  const validFree = verifyShippingQuoteToken({
    token: freeToken,
    postcode: "3000",
    destinationKey,
    shipmentKey: freeTokenKey,
    serviceCode: MEMBER_FREE_DELIVERY_CODE,
    price: 0,
  });
  assert.ok(validFree, "Free delivery member quote token must verify cleanly");

  // Tampered price or postcode must fail verification
  assert.ok(!verifyShippingQuoteToken({
    token: freeToken,
    postcode: "3000",
    destinationKey,
    shipmentKey: freeTokenKey,
    serviceCode: MEMBER_FREE_DELIVERY_CODE,
    price: 15,
  }), "Tampered price must fail verification");

  assert.ok(!verifyShippingQuoteToken({
    token: freeToken,
    postcode: "5000",
    destinationKey,
    shipmentKey: freeTokenKey,
    serviceCode: MEMBER_FREE_DELIVERY_CODE,
    price: 0,
  }), "Mismatched destination postcode must fail verification");

  // Fixed delivery token ($25.00)
  const fixedTokenKey = buildMemberOverriddenShipmentKey(items, 2500);
  const fixedToken = createShippingQuoteToken({
    postcode: "3000",
    destinationKey,
    shipmentKey: fixedTokenKey,
    serviceCode: MEMBER_FIXED_DELIVERY_CODE,
    price: 25.0,
  });

  const validFixed = verifyShippingQuoteToken({
    token: fixedToken,
    postcode: "3000",
    destinationKey,
    shipmentKey: fixedTokenKey,
    serviceCode: MEMBER_FIXED_DELIVERY_CODE,
    price: 25.0,
  });
  assert.ok(validFixed, "Fixed delivery member quote token must verify cleanly");
});

test("memberDeliveryShipmentKey safely differentiates standard vs member-overridden shipments", () => {
  const baseKey = "base-sha256-hash";

  const nonMemberKey = memberDeliveryShipmentKey(baseKey, {
    hasMemberDeliveryOverride: false,
    fixedDeliveryCents: 0,
  });
  assert.equal(nonMemberKey, baseKey);

  const memberKey = memberDeliveryShipmentKey(baseKey, {
    hasMemberDeliveryOverride: true,
    fixedDeliveryCents: 1500,
  });
  assert.equal(memberKey, `${baseKey}|member:1500`);
});
