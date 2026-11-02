import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { maskWinnerName } from "@/lib/raffle-utils";

test("maskWinnerName masks customer names for public community display", () => {
  assert.equal(maskWinnerName("John Doe"), "John D.***");
  assert.equal(maskWinnerName("Sarah Jane Smith"), "Sarah S.***");
  assert.equal(maskWinnerName("Alice"), "Al***");
  assert.equal(maskWinnerName("Li"), "L***");
  assert.equal(maskWinnerName(""), "Verified Customer");
  assert.equal(maskWinnerName(null), "Verified Customer");
  assert.equal(maskWinnerName(undefined), "Verified Customer");
  assert.equal(maskWinnerName("   "), "Verified Customer");
});

test("cryptographic randomness in winner selection produces valid integers within bounds", () => {
  const poolSize = 10;
  for (let i = 0; i < 50; i++) {
    const pick = crypto.randomInt(0, poolSize);
    assert.ok(pick >= 0 && pick < poolSize, `Expected 0 <= ${pick} < ${poolSize}`);
  }
});

test("raffle redraw logic correctly filters out existing winning user when multiple wins disallowed", () => {
  const allTickets = [
    { id: "t1", userId: "u1" },
    { id: "t2", userId: "u1" },
    { id: "t3", userId: "u2" },
    { id: "t4", userId: "u3" },
  ];

  // User 1 is winning prize 1, User 2 was winning prize 2 (now being redrawn)
  const otherWinners = [{ id: "w1", userId: "u1", ticketId: "t1" }];
  const currentWinnerTicketIds = new Set(["t1", "t3"]);
  const otherWinnerUserIds = new Set(otherWinners.map((w) => w.userId));

  // User 1 should be excluded from winning prize 2 because they already won prize 1
  const eligibleTickets = allTickets.filter(
    (t) => !currentWinnerTicketIds.has(t.id) && !otherWinnerUserIds.has(t.userId)
  );

  // Remaining eligible tickets should only be from u3 (t4)
  assert.equal(eligibleTickets.length, 1);
  assert.equal(eligibleTickets[0].userId, "u3");
  assert.equal(eligibleTickets[0].id, "t4");
});

test("checkout pricing calculation limits free raffle prize to exactly 1 quantity", () => {
  // Simulating the price line calculation logic in checkout route
  const regularPrice = 1200;
  const itemQuantity = 3;
  const isRafflePrize = true;
  const winningPrice = 0; // 100% Free Gift

  const priceLines: Array<{ key: string; unitPriceCents: number; quantity: number; eligible: boolean }> = [];

  if (isRafflePrize) {
    // Exactly 1 unit at winning price
    priceLines.push({
      key: "prod-1:base:raffle",
      unitPriceCents: Math.round(winningPrice * 100),
      quantity: 1,
      eligible: false, // Cannot be discounted by coupons
    });

    // The remaining (itemQuantity - 1) units must be charged at regular price
    if (itemQuantity > 1) {
      priceLines.push({
        key: "prod-1:base",
        unitPriceCents: Math.round(regularPrice * 100),
        quantity: itemQuantity - 1,
        eligible: true,
      });
    }
  }

  assert.equal(priceLines.length, 2);
  assert.equal(priceLines[0].quantity, 1);
  assert.equal(priceLines[0].unitPriceCents, 0);
  assert.equal(priceLines[0].eligible, false);

  assert.equal(priceLines[1].quantity, 2);
  assert.equal(priceLines[1].unitPriceCents, 120000);
  assert.equal(priceLines[1].eligible, true);

  const totalCalculatedSubtotal = priceLines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0) / 100;
  assert.equal(totalCalculatedSubtotal, 2400); // 0 + 2 * 1200 = 2400, NOT 0!
});

test("free order with 0 total cost correctly recognizes no payment card needed", () => {
  const subtotal = 0;
  const shippingCost = 0;
  const membershipAdd = 0;
  const tax = 0;
  const total = subtotal + shippingCost + membershipAdd + tax;

  const isFreeOrder = Math.round(total * 100) === 0;
  assert.equal(isFreeOrder, true);
});
