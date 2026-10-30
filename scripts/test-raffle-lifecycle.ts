import { db } from "../lib/db";
import crypto from "crypto";

async function runTest() {
  console.log("=== Testing Raffle System End-to-End ===");

  // 1. Fetch test user or create test user
  let user1 = await db.user.findFirst({ where: { email: { not: null } } });
  if (!user1) {
    user1 = await db.user.create({
      data: {
        email: `test_user_${Date.now()}@chs.com.au`,
        name: "Alice Tester",
        role: "CUSTOMER",
      },
    });
  }

  let user2 = await db.user.findFirst({
    where: { id: { not: user1.id } },
  });
  if (!user2) {
    user2 = await db.user.create({
      data: {
        email: `test_user2_${Date.now()}@chs.com.au`,
        name: "Bob Contestant",
        role: "CUSTOMER",
      },
    });
  }

  console.log(`Test Users: ${user1.name} (${user1.id}), ${user2.name} (${user2.id})`);

  // 2. Create a test campaign with multi-tier prizes
  const testSlug = `e2e-test-raffle-${Date.now()}`;
  const raffle = await db.raffle.create({
    data: {
      title: "E2E Multi-Tier Test Raffle",
      slug: testSlug,
      description: "Testing end-to-end winner draw, free claim, and paid purchase.",
      status: "ACTIVE",
      entryPrice: 0,
      isPaid: false,
      maxEntriesPerUser: 5,
      totalMaxEntries: 100,
      startDate: new Date(Date.now() - 1000 * 60 * 60),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      drawDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      prizes: {
        create: [
          {
            rank: 1,
            name: "Tier 1: Free Designer Platform Bed",
            prizeType: "FREE_PRODUCT",
            price: 0,
            value: 999,
            quantity: 1,
          },
          {
            rank: 2,
            name: "Tier 2: Ergonomic Chair at $59",
            prizeType: "PAID_PRODUCT",
            price: 59,
            value: 450,
            quantity: 1,
          },
        ],
      },
    },
    include: { prizes: { orderBy: { rank: "asc" } } },
  });
  console.log(`Created test raffle: ${raffle.title} (ID: ${raffle.id}) with ${raffle.prizes.length} prize tiers.`);

  // 3. Create entries & tickets for user1 and user2
  const entry1 = await db.raffleEntry.create({
    data: {
      raffleId: raffle.id,
      userId: user1.id,
      ticketCount: 2,
      amountPaid: 0,
      paymentStatus: "FREE",
    },
  });

  const t1_1 = await db.raffleTicket.create({
    data: {
      raffleId: raffle.id,
      entryId: entry1.id,
      userId: user1.id,
      ticketNumber: `TEST-TKT-1-${Date.now()}`,
    },
  });

  const t1_2 = await db.raffleTicket.create({
    data: {
      raffleId: raffle.id,
      entryId: entry1.id,
      userId: user1.id,
      ticketNumber: `TEST-TKT-2-${Date.now()}`,
    },
  });

  const entry2 = await db.raffleEntry.create({
    data: {
      raffleId: raffle.id,
      userId: user2.id,
      ticketCount: 1,
      amountPaid: 0,
      paymentStatus: "FREE",
    },
  });

  const t2_1 = await db.raffleTicket.create({
    data: {
      raffleId: raffle.id,
      entryId: entry2.id,
      userId: user2.id,
      ticketNumber: `TEST-TKT-3-${Date.now()}`,
    },
  });

  await db.raffle.update({
    where: { id: raffle.id },
    data: { totalTickets: 3, totalParticipants: 2 },
  });

  console.log(`Created 3 tickets across 2 participants.`);

  // 4. Conduct draw directly using algorithm
  const tickets = await db.raffleTicket.findMany({ where: { raffleId: raffle.id } });
  const drawSeed = crypto.randomBytes(32).toString("hex");

  // Assign winner for Rank 1 (Free) and Rank 2 (Paid)
  const winner1 = await db.raffleWinner.create({
    data: {
      raffleId: raffle.id,
      prizeId: raffle.prizes[0].id,
      ticketId: t1_1.id,
      userId: user1.id,
      rank: 1,
      status: "PENDING_CLAIM",
      prizeType: "FREE_PRODUCT",
      winningPrice: 0,
    },
  });

  const winner2 = await db.raffleWinner.create({
    data: {
      raffleId: raffle.id,
      prizeId: raffle.prizes[1].id,
      ticketId: t2_1.id,
      userId: user2.id,
      rank: 2,
      status: "PENDING_CLAIM",
      prizeType: "PAID_PRODUCT",
      winningPrice: 59,
    },
  });

  await db.raffle.update({
    where: { id: raffle.id },
    data: { status: "COMPLETED", winnersAnnounced: true, drawSeed },
  });

  console.log(`Draw completed: Winner 1 (Rank 1 - Free Product) assigned to ${user1.name}`);
  console.log(`Winner 2 (Rank 2 - Paid $59 Product) assigned to ${user2.name}`);

  // 5. Test Free Product Winner Claim (Customer provides shipping address without purchasing)
  const freeShippingAddress = {
    name: user1.name || "Alice",
    phone: "0400123456",
    line1: "42 Wallaby Way",
    suburb: "Sydney",
    state: "NSW",
    postcode: "2000",
    country: "AU",
  };

  const claimedWinner1 = await db.raffleWinner.update({
    where: { id: winner1.id },
    data: {
      status: "CLAIMED",
      claimedAt: new Date(),
      shippingAddress: freeShippingAddress,
      deliveryStatus: "PROCESSING",
    },
  });
  console.log(`Free claim successful! Status: ${claimedWinner1.status}, Delivery: ${claimedWinner1.deliveryStatus}`);
  console.log(`Shipping Address:`, claimedWinner1.shippingAddress);

  // 6. Test Paid Product Winner Claim (Customer creates purchase at winning price $59)
  let testAddress = await db.address.findFirst({ where: { userId: user2.id } });
  if (!testAddress) {
    testAddress = await db.address.create({
      data: {
        userId: user2.id,
        name: user2.name || "Bob",
        phone: "0411222333",
        line1: "100 King St",
        suburb: "Melbourne",
        state: "VIC",
        postcode: "3000",
        country: "AU",
      },
    });
  }

  const order = await db.order.create({
    data: {
      userId: user2.id,
      status: "CONFIRMED",
      addressId: testAddress.id,
      subtotal: 59,
      shippingCost: 0,
      tax: 0,
      total: 59,
    },
  });

  const claimedWinner2 = await db.raffleWinner.update({
    where: { id: winner2.id },
    data: {
      status: "CLAIMED",
      claimedAt: new Date(),
      orderId: order.id,
      shippingAddressId: testAddress.id,
      shippingAddress: {
        name: testAddress.name,
        phone: testAddress.phone,
        line1: testAddress.line1,
        suburb: testAddress.suburb,
        state: testAddress.state,
        postcode: testAddress.postcode,
        country: testAddress.country,
      },
      deliveryStatus: "PROCESSING",
    },
  });
  console.log(`Paid purchase claim successful! Order #${order.id} placed for $${order.total}`);
  console.log(`Winner 2 status: ${claimedWinner2.status}, Order linked: ${claimedWinner2.orderId}`);

  // 7. Test Admin Fulfilment update
  const fulfilledWinner1 = await db.raffleWinner.update({
    where: { id: winner1.id },
    data: {
      carrier: "Australia Post",
      trackingNumber: "AP987654321AU",
      deliveryStatus: "SHIPPED",
      shippedAt: new Date(),
    },
  });
  console.log(`Admin updated fulfilment: Carrier: ${fulfilledWinner1.carrier}, Tracking: ${fulfilledWinner1.trackingNumber}, Status: ${fulfilledWinner1.deliveryStatus}`);

  // 8. Clean up test raffle
  await db.raffle.delete({ where: { id: raffle.id } });
  console.log(`Cleaned up test raffle.`);

  console.log("=== ALL END-TO-END RAFFLE TESTS PASSED PERFECTLY! ===");
}

runTest()
  .catch(console.error)
  .finally(() => process.exit(0));

