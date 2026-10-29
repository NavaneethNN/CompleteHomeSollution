import assert from "node:assert/strict";
import test from "node:test";
import {
  couriersPleaseSenderFromEnv,
  checkCouriersPleaseAvailability,
  formatPickupDateTime,
  CouriersPleaseError,
} from "../lib/couriersplease";
import { getTrackingUrl } from "../lib/tracking-url";

test("couriersPleaseSenderFromEnv loads configured environment variables", () => {
  const sender = couriersPleaseSenderFromEnv();
  assert.equal(sender.name, "Complete Home Solution");
  assert.equal(sender.line1, "18 Edison Drive");
  assert.equal(sender.suburb, "Golden Grove");
  assert.equal(sender.state, "SA");
  assert.equal(sender.postcode, "5125");
  assert.ok(sender.phone);
});

test("checkCouriersPleaseAvailability checks required account and key", (t) => {
  const prevAccount = process.env.COURIER_PLEASE_ACCOUNT_ID;
  const prevKey = process.env.COURIER_PLEASE_API_KEY;

  t.after(() => {
    if (prevAccount !== undefined) process.env.COURIER_PLEASE_ACCOUNT_ID = prevAccount;
    else delete process.env.COURIER_PLEASE_ACCOUNT_ID;
    if (prevKey !== undefined) process.env.COURIER_PLEASE_API_KEY = prevKey;
    else delete process.env.COURIER_PLEASE_API_KEY;
  });

  // When credentials are set
  process.env.COURIER_PLEASE_ACCOUNT_ID = "113206585";
  process.env.COURIER_PLEASE_API_KEY = "test_key";
  assert.equal(checkCouriersPleaseAvailability().available, true);
  assert.equal(checkCouriersPleaseAvailability().reason, null);

  // When credentials are missing or empty
  process.env.COURIER_PLEASE_ACCOUNT_ID = "";
  process.env.COURIER_PLEASE_API_KEY = "";
  assert.equal(checkCouriersPleaseAvailability().available, false);
  assert.ok(checkCouriersPleaseAvailability().reason);
});

test("formatPickupDateTime formats properly for Couriers Please bookPickup API", () => {
  const d = new Date(2026, 9, 27, 9, 30); // 2026-10-27 09:30 AM
  const formatted = formatPickupDateTime(d);
  assert.match(formatted, /^2026-10-27 09:30 AM$/);

  const afternoon = new Date(2026, 9, 27, 14, 15); // 2026-10-27 02:15 PM
  assert.match(formatPickupDateTime(afternoon), /^2026-10-27 02:15 PM$/);
});

test("getTrackingUrl resolves Couriers Please tracking URLs correctly", () => {
  const url = getTrackingUrl("Couriers Please", "CP99887766");
  assert.equal(url, "https://www.couriersplease.com.au/tools-track/result?trackingNumber=CP99887766");

  const urlWithSpaces = getTrackingUrl("couriersplease", "CP 123 456");
  assert.equal(urlWithSpaces, "https://www.couriersplease.com.au/tools-track/result?trackingNumber=CP%20123%20456");
});
