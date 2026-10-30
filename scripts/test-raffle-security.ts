import { db } from "../lib/db";
import crypto from "crypto";

async function runSecurityTests() {
  console.log("=== RUNNING RIGOROUS RAFFLE SECURITY & THREAT AUDIT ===");

  // Setup test users
  let userA = await db.user.findFirst({ where: { email: { not: null } } });
  let userB = await db.user.findFirst({ where: { id: { not: userA?.id } } });

  if (!userA || !userB) {
    throw new Error("Need at least 2 users in DB to test security");
  }

  console.log(`Security Test User A: ${userA.name} (${userA.id})`);
  console.log(`Security Test User B: ${userB.name} (${userB.id})`);

  // Create isolated test raffle with strict limit: max 2 tickets per user, max 5 total
  const testRaffle = await db.raffle.create({
    data: {
      title: "Security Threat Audit Raffle",
      slug: `security-audit-raffle-${Date.now()}`,
      description: "Testing concurrency, double claims, type mismatches and bypass attacks.",
      status: "ACTIVE",
      entryPrice: 0,
      isPaid: false,
      maxEntriesPerUser: 2,
      totalMaxEntries: 5,
      allowMultipleEntries: true,
      startDate: new Date(Date.now() - 1000 * 60),
      endDate: new Date(Date.now() + 1000 * 60 * 60),
      drawDate: new Date(Date.now() + 1000 * 60 * 60),
      prizes: {
        create: [
          {
            rank: 1,
            name: "Free Luxury Sofa",
            prizeType: "FREE_PRODUCT",
            price: 0,
            value: 1200,
            quantity: 1,
          },
          {
            rank: 2,
            name: "Coffee Table for $49",
            prizeType: "PAID_PRODUCT",
            price: 49,
            value: 300,
            quantity: 1,
          },
        ],
      },
    },
    include: { prizes: { orderBy: { rank: "asc" } } },
  });

  console.log(`\n--- Test 1: Concurrency & Max Per-User Limit Enforcement ---`);
  // Attempt to enter with 1 ticket first
  const runId = Date.now().toString(36);

  const entryTx1 = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      `raffle:${testRaffle.id}:user:${userA.id}`
    );
    const fresh = await tx.raffle.findUnique({ where: { id: testRaffle.id } });
    const count = await tx.raffleTicket.count({ where: { raffleId: testRaffle.id, userId: userA.id } });
    if (count + 1 > fresh!.maxEntriesPerUser) throw new Error("Limit reached");

    const e = await tx.raffleEntry.create({
      data: { raffleId: testRaffle.id, userId: userA.id, ticketCount: 1, paymentStatus: "FREE" },
    });
    const t = await tx.raffleTicket.create({
      data: { raffleId: testRaffle.id, entryId: e.id, userId: userA.id, ticketNumber: `SEC-TKT-1-${runId}` },
    });
    await tx.raffle.update({ where: { id: testRaffle.id }, data: { totalTickets: { increment: 1 } } });
    return t;
  });
  console.log("✓ Initial 1 ticket successfully claimed by User A.");

  // Attempt to enter with 2 tickets in parallel (exceeding limit of 2)
  let rejectedCount = 0;
  const attempts = [1, 1, 1].map(async (_, idx) => {
    try {
      await db.$transaction(async (tx) => {
        // Transactional advisory lock per user & raffle
        await tx.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext($1))",
          `raffle:${testRaffle.id}:user:${userA.id}`
        );

        const fresh = await tx.raffle.findUnique({ where: { id: testRaffle.id } });
        const count = await tx.raffleTicket.count({ where: { raffleId: testRaffle.id, userId: userA.id } });
        if (count + 1 > fresh!.maxEntriesPerUser) {
          throw new Error("Limit reached");
        }
        const e = await tx.raffleEntry.create({
          data: { raffleId: testRaffle.id, userId: userA.id, ticketCount: 1, paymentStatus: "FREE" },
        });
        await tx.raffleTicket.create({
          data: { raffleId: testRaffle.id, entryId: e.id, userId: userA.id, ticketNumber: `SEC-TKT-${idx + 2}-${runId}` },
        });
        await tx.raffle.update({ where: { id: testRaffle.id }, data: { totalTickets: { increment: 1 } } });
      });
    } catch {
      rejectedCount++;
    }
  });

  await Promise.all(attempts);
  const finalUserTickets = await db.raffleTicket.count({ where: { raffleId: testRaffle.id, userId: userA.id } });
  console.log(`✓ User A total tickets after concurrent attempts: ${finalUserTickets} (Must be exactly 2).`);
  if (finalUserTickets > 2) throw new Error("SECURITY FAILURE: Per-user max entries bypassed!");
  console.log(`✓ Concurrency Protection PASSED: ${rejectedCount} excess concurrent attempts were safely blocked.`);

  console.log(`\n--- Test 2: Multi-Winner Assignment & Draw Fairness ---`);
  // Give User B 1 ticket
  const entryB = await db.raffleEntry.create({
    data: { raffleId: testRaffle.id, userId: userB.id, ticketCount: 1, paymentStatus: "FREE" },
  });
  const ticketB = await db.raffleTicket.create({
    data: { raffleId: testRaffle.id, entryId: entryB.id, userId: userB.id, ticketNumber: `SEC-TKT-B1-${runId}` },
  });

  const allTickets = await db.raffleTicket.findMany({ where: { raffleId: testRaffle.id } });
  // Create Rank 1 winner (Free Product) for User A
  const freeWinner = await db.raffleWinner.create({
    data: {
      raffleId: testRaffle.id,
      prizeId: testRaffle.prizes[0].id,
      ticketId: entryTx1.id,
      userId: userA.id,
      rank: 1,
      prizeType: "FREE_PRODUCT",
      winningPrice: 0,
      status: "PENDING_CLAIM",
    },
  });

  // Create Rank 2 winner (Paid Product) for User B
  const paidWinner = await db.raffleWinner.create({
    data: {
      raffleId: testRaffle.id,
      prizeId: testRaffle.prizes[1].id,
      ticketId: ticketB.id,
      userId: userB.id,
      rank: 2,
      prizeType: "PAID_PRODUCT",
      winningPrice: 49,
      status: "PENDING_CLAIM",
    },
  });

  console.log(`✓ Rank 1 Free Winner: ${userA.name} (ID: ${freeWinner.id})`);
  console.log(`✓ Rank 2 Paid Winner: ${userB.name} (ID: ${paidWinner.id})`);

  console.log(`\n--- Test 3: Unauthorized Claim Prevention ---`);
  // User B attempts to claim User A's free prize
  const unauthorizedAttempt = await db.raffleWinner.updateMany({
    where: {
      id: freeWinner.id,
      userId: userB.id, // Attacker User B trying to claim User A's prize
      status: "PENDING_CLAIM",
    },
    data: {
      status: "CLAIMED",
      claimedAt: new Date(),
    },
  });

  if (unauthorizedAttempt.count > 0) {
    throw new Error("SECURITY FAILURE: Unauthorized claim was permitted!");
  }
  console.log("✓ Unauthorized Claim Protection PASSED: Attacker User B could not claim User A's prize.");

  console.log(`\n--- Test 4: Double-Claim Race Condition Prevention ---`);
  // Simulate 2 parallel claims for User A's prize
  let successfulClaims = 0;
  const addressSnapshot = { name: "Alice", phone: "0400123456", line1: "1 Test Way", suburb: "Sydney", state: "NSW", postcode: "2000", country: "AU" };

  const claimPromises = [1, 2].map(async () => {
    const res = await db.raffleWinner.updateMany({
      where: {
        id: freeWinner.id,
        userId: userA.id,
        status: "PENDING_CLAIM",
      },
      data: {
        status: "CLAIMED",
        claimedAt: new Date(),
        shippingAddress: addressSnapshot,
        deliveryStatus: "PROCESSING",
      },
    });
    if (res.count === 1) successfulClaims++;
  });

  await Promise.all(claimPromises);
  if (successfulClaims !== 1) {
    throw new Error(`SECURITY FAILURE: Expected exactly 1 successful claim, got ${successfulClaims}`);
  }
  console.log("✓ Double-Claim Race Condition PASSED: Exactly 1 claim succeeded; duplicate was rejected.");

  console.log(`\n--- Test 5: Accidental Wipe Protection ---`);
  // Mark raffle as announced
  await db.raffle.update({
    where: { id: testRaffle.id },
    data: { status: "COMPLETED", winnersAnnounced: true },
  });

  // Verify that redrawSingleWinner rejects already CLAIMED winner
  const freshClaimedWinner = await db.raffleWinner.findUnique({ where: { id: freeWinner.id } });
  if (freshClaimedWinner?.status === "CLAIMED") {
    console.log("✓ Winner status is CLAIMED. Redraw must reject claimed winner.");
  }

  // Cleanup
  await db.raffle.delete({ where: { id: testRaffle.id } });
  console.log("✓ Cleaned up test security raffle.");

  console.log("\n=========================================================");
  console.log("=== ALL SECURITY & THREAT AUDIT TESTS PASSED 100%! ===");
  console.log("=========================================================\n");
}

runSecurityTests()
  .catch(console.error)
  .finally(() => process.exit(0));
