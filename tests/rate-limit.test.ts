import assert from "node:assert/strict";
import test from "node:test";
import { clearRateLimitsForTests, consumeRateLimit, getClientIp } from "../lib/rate-limit";

test("local development limiter enforces a fixed window", async () => {
  clearRateLimitsForTests();
  assert.equal((await consumeRateLimit("test", "person@example.com", 2, 60)).allowed, true);
  assert.equal((await consumeRateLimit("test", "person@example.com", 2, 60)).allowed, true);
  const blocked = await consumeRateLimit("test", "person@example.com", 2, 60);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});

test("client IP parser rejects malformed forwarded values", () => {
  assert.equal(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })), "203.0.113.5");
  assert.equal(getClientIp(new Headers({ "x-forwarded-for": "not-an-ip" })), "unknown");
});
