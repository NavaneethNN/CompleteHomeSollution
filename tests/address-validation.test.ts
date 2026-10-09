import { test } from "node:test";
import assert from "node:assert/strict";
import { addressSchema } from "../lib/validations/address";

const address = { name: "Test Buyer", phone: "0400000000", line1: "1 Test Road", suburb: "Unlisted suburb", state: "NSW", postcode: "2000", country: "AU" };

test("delivery validation permits unlisted suburbs but bounds state and country", () => {
  assert.equal(addressSchema.safeParse(address).success, true);
  for (const state of ["", "XX", "x".repeat(10000)]) assert.equal(addressSchema.safeParse({ ...address, state }).success, false);
  for (const country of ["", "US", "x".repeat(10000)]) assert.equal(addressSchema.safeParse({ ...address, country }).success, false);
});
