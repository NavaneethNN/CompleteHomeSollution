import assert from "node:assert/strict";
import test from "node:test";
import { getTrackingUrl } from "../lib/tracking-url";

test("creates direct links for supported couriers", () => {
  assert.equal(
    getTrackingUrl("Australia Post", "AB 123/45"),
    "https://auspost.com.au/mypost/track/#/details/AB%20123%2F45"
  );
  assert.equal(
    getTrackingUrl("DHL Express", "123456"),
    "https://www.dhl.com/au-en/home/tracking.html?tracking-id=123456"
  );
});

test("does not create external links from unrecognised courier text", () => {
  assert.equal(getTrackingUrl("javascript:alert(1)", "123"), null);
  assert.equal(getTrackingUrl("Australia Post", "  "), null);
});
