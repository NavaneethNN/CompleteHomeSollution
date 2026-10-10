import { test } from "node:test";
import assert from "node:assert/strict";
import { releaseConfigErrors } from "../lib/release-config";

const valid = {
  DATABASE_URL: "postgresql://example.invalid/db",
  NEXT_PUBLIC_APP_URL: "https://staging.example.com",
  AUTH_URL: "https://staging.example.com",
  NEXTAUTH_URL: "https://staging.example.com",
  AUTH_SECRET: "a".repeat(32),
  CRON_SECRET: "b".repeat(32),
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "token",
  BREVO_API_KEY: "key",
  SENTRY_DSN: "https://public-key@sentry.example.com/1",
  PAYMENT_GATEWAY: "onlinepay",
  NEXT_PUBLIC_PAYMENT_GATEWAY: "onlinepay",
  ONLINEPAY_USER_UID: "uid",
  ONLINEPAY_API_KEY: "key",
  ONLINEPAY_ENTITY_ID: "entity",
  ONLINEPAY_PPC_ID: "ppc",
  ONLINEPAY_3DS_ID: "3ds",
  ONLINEPAY_WEBHOOK_SECRET: "c".repeat(32),
  ONLINEPAY_RETURN_BASE_URL: "https://staging.example.com",
  ONLINEPAY_MODE: "test",
};

test("release preflight accepts matching HTTPS origins and required secrets", () => {
  assert.deepEqual(releaseConfigErrors(valid), []);
});

test("release preflight rejects unsafe return/auth origins and weak scheduler secrets", () => {
  const errors = releaseConfigErrors({ ...valid,
    NEXT_PUBLIC_APP_URL: "https://staging.example.com/path",
    AUTH_URL: "http://localhost:3000",
    ONLINEPAY_RETURN_BASE_URL: "https://other.example.com",
    CRON_SECRET: "short",
  });
  assert.ok(errors.some(error => error.includes("NEXT_PUBLIC_APP_URL")));
  assert.ok(errors.some(error => error.includes("AUTH_URL")));
  assert.ok(errors.some(error => error.includes("ONLINEPAY_RETURN_BASE_URL")));
  assert.ok(errors.some(error => error.includes("CRON_SECRET")));
});

test("release preflight rejects localhost as a payment return origin", () => {
  const errors = releaseConfigErrors({ ...valid,
    NEXT_PUBLIC_APP_URL: "https://localhost:3000",
    AUTH_URL: "https://localhost:3000",
    NEXTAUTH_URL: "https://localhost:3000",
    ONLINEPAY_RETURN_BASE_URL: "https://localhost:3000",
  });
  assert.ok(errors.some(error => error.includes("reachable by payment providers")));
});

test("release preflight rejects placeholder monitoring and invalid shared limiter URLs", () => {
  const errors = releaseConfigErrors({ ...valid, SENTRY_DSN: "your_sentry_dsn_here", UPSTASH_REDIS_REST_URL: "http://redis.example.com" });
  assert.ok(errors.some(error => error.includes("SENTRY_DSN")));
  assert.ok(errors.some(error => error.includes("UPSTASH_REDIS_REST_URL")));
});

test("release preflight requires explicit matching server and public gateway settings", () => {
  assert.ok(releaseConfigErrors({ ...valid, PAYMENT_GATEWAY: undefined }).some(error => error.includes("PAYMENT_GATEWAY")));
  assert.ok(releaseConfigErrors({ ...valid, NEXT_PUBLIC_PAYMENT_GATEWAY: undefined }).some(error => error.includes("NEXT_PUBLIC_PAYMENT_GATEWAY")));
});
