import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}

let mockUser: any = null;
let updatedUserData: any = null;
let sentEmails: any[] = [];

const dbMock = {
  user: {
    findUnique: async ({ where }: any) => {
      if (mockUser && mockUser.id === where.id) {
        return structuredClone(mockUser);
      }
      return null;
    },
    update: async ({ where, data }: any) => {
      if (mockUser && mockUser.id === where.id) {
        Object.assign(mockUser, data);
        updatedUserData = data;
        return structuredClone(mockUser);
      }
      throw new Error("User not found");
    },
  },
};

stub("../lib/db", { db: dbMock });
stub("../lib/membership-notifications", {
  sendMembershipCancelledEmail: async (email: string, name: string) => {
    sentEmails.push({ type: "CANCELLED", email, name });
  },
  sendMembershipPaymentRetryEmail: async (email: string, name: string, retryCount: number, nextRetryDate: Date) => {
    sentEmails.push({ type: "RETRY", email, name, retryCount, nextRetryDate });
  },
  sendMembershipRevokedFailureEmail: async (email: string, name: string, reason: string) => {
    sentEmails.push({ type: "REVOKED_FAILURE", email, name, reason });
  },
});

const {
  cancelMembership,
  toggleMembershipAutoRenew,
  processFailedRenewal,
} = require("../lib/membership") as typeof import("../lib/membership");

test("cancelMembership revokes autopay and revokes membership immediately", async () => {
  mockUser = {
    id: "user-123",
    email: "customer@example.com",
    name: "John Doe",
    isMember: true,
    membershipAutoRenew: true,
    membershipExpiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
    membershipRetryCount: 0,
    membershipStatus: "ACTIVE",
  };
  sentEmails = [];

  await cancelMembership("user-123");

  assert.equal(mockUser.isMember, false);
  assert.equal(mockUser.membershipAutoRenew, false);
  assert.equal(mockUser.membershipStatus, "CANCELLED");
  assert.equal(mockUser.membershipCancelReason, "Cancelled manually by customer");
  assert.equal(mockUser.membershipExpiry, null);
  assert.ok(mockUser.membershipCancelledAt instanceof Date);

  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].type, "CANCELLED");
  assert.equal(sentEmails[0].email, "customer@example.com");
});

test("toggleMembershipAutoRenew toggles autopay flag", async () => {
  mockUser = {
    id: "user-123",
    membershipAutoRenew: true,
  };

  const result = await toggleMembershipAutoRenew("user-123", false);
  assert.equal(result, false);
  assert.equal(mockUser.membershipAutoRenew, false);

  const result2 = await toggleMembershipAutoRenew("user-123", true);
  assert.equal(result2, true);
  assert.equal(mockUser.membershipAutoRenew, true);
});

test("processFailedRenewal attempts 2 retries on different days and then revokes membership for payment method failure", async () => {
  mockUser = {
    id: "user-123",
    email: "customer@example.com",
    name: "John Doe",
    isMember: true,
    membershipAutoRenew: true,
    membershipExpiry: new Date(),
    membershipRetryCount: 0,
    membershipStatus: "ACTIVE",
  };
  sentEmails = [];

  // Attempt 1: Should schedule retry #1 on different day (+24h) and notify customer
  const attempt1 = await processFailedRenewal("user-123", "Insufficient funds");
  assert.equal(attempt1.revoked, false);
  assert.equal(attempt1.retryCount, 1);
  assert.equal(mockUser.isMember, true); // Still active during retry period
  assert.equal(mockUser.membershipRetryCount, 1);
  assert.equal(mockUser.membershipStatus, "PAYMENT_RETRYING");
  assert.ok(mockUser.membershipNextRetryAt > new Date());
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].type, "RETRY");
  assert.equal(sentEmails[0].retryCount, 1);

  // Attempt 2: Should schedule retry #2 on different day and notify customer
  const attempt2 = await processFailedRenewal("user-123", "Card declined");
  assert.equal(attempt2.revoked, false);
  assert.equal(attempt2.retryCount, 2);
  assert.equal(mockUser.isMember, true);
  assert.equal(mockUser.membershipRetryCount, 2);
  assert.equal(sentEmails.length, 2);
  assert.equal(sentEmails[1].type, "RETRY");
  assert.equal(sentEmails[1].retryCount, 2);

  // Attempt 3: Final attempt after 2 retries -> REVOKE MEMBERSHIP IMMEDIATELY!
  const attempt3 = await processFailedRenewal("user-123", "Card declined");
  assert.equal(attempt3.revoked, true);
  assert.equal(attempt3.retryCount, 3);
  assert.equal(mockUser.isMember, false);
  assert.equal(mockUser.membershipAutoRenew, false);
  assert.equal(mockUser.membershipStatus, "REVOKED_PAYMENT_FAILURE");
  assert.ok(mockUser.membershipCancelReason.includes("Payment method failure issue"));
  assert.equal(mockUser.membershipExpiry, null);
  assert.equal(mockUser.membershipNextRetryAt, null);

  assert.equal(sentEmails.length, 3);
  assert.equal(sentEmails[2].type, "REVOKED_FAILURE");
  assert.ok(sentEmails[2].reason.includes("Payment method failure issue"));
});

test("resolveMemberPrice uses manual price if uploaded or falls back to 5% discount up to $30 cap", () => {
  const { resolveMemberPrice } = require("../lib/member-price");

  // 1. Manual price uploaded on variant or product
  assert.equal(resolveMemberPrice(100, 80, null), 80);
  assert.equal(resolveMemberPrice(100, null, 85), 85);

  // 2. No manual price uploaded: 5% discount applies
  assert.equal(resolveMemberPrice(100, null, null), 95); // 5% of $100 = $5
  assert.equal(resolveMemberPrice(20, null, null), 19);   // 5% of $20 = $1

  // 3. No manual price uploaded: 5% exceeds $30 cap -> capped at $30 off
  assert.equal(resolveMemberPrice(1000, null, null), 970); // 5% of $1000 is $50, capped at $30 -> $970
  assert.equal(resolveMemberPrice(2000, null, null), 1970); // 5% of $2000 is $100, capped at $30 -> $1970
});

