import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { releaseCouponReservationInTransaction } from "../lib/coupon-reservation";

test("a closed checkout releases its global and per-user coupon reservation once", async () => {
  const state = { reserved: true, usageCount: 1, userUses: 1 };
  const tx = {
    order: {
      findUnique: async () => ({ couponId: "coupon", couponReserved: state.reserved }),
      updateMany: async () => {
        if (!state.reserved) return { count: 0 };
        state.reserved = false;
        return { count: 1 };
      },
    },
    coupon: {
      updateMany: async () => { state.usageCount--; return { count: 1 }; },
    },
    userCoupon: {
      deleteMany: async () => { const count = state.userUses; state.userUses = 0; return { count }; },
    },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await releaseCouponReservationInTransaction(tx, "order"), true);
  assert.deepEqual(state, { reserved: false, usageCount: 0, userUses: 0 });
  assert.equal(await releaseCouponReservationInTransaction(tx, "order"), false);
  assert.deepEqual(state, { reserved: false, usageCount: 0, userUses: 0 });
});
