"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ClaimPrizeAddressInput } from "@/lib/validations/raffle";
import { consumeRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export interface RaffleFilters {
  status?: "ALL" | "ACTIVE" | "UPCOMING" | "COMPLETED";
  featuredOnly?: boolean;
}

/**
 * Fetch public raffles for the customer listing page
 */
export async function getPublicRaffles(filters?: RaffleFilters) {
  try {
    // Auto-update statuses based on dates if necessary
    await autoUpdateRaffleStatuses();

    const where: any = {};

    if (filters?.featuredOnly) {
      where.isFeatured = true;
    }

    if (filters?.status === "ACTIVE") {
      where.status = "ACTIVE";
    } else if (filters?.status === "UPCOMING") {
      where.status = "UPCOMING";
    } else if (filters?.status === "COMPLETED") {
      where.status = { in: ["DRAW_COMPLETED", "WINNER_VERIFICATION", "COMPLETED"] };
    } else {
      // Default: show all non-draft, non-cancelled
      where.status = {
        in: ["UPCOMING", "ACTIVE", "CLOSED", "DRAW_PENDING", "DRAW_COMPLETED", "WINNER_VERIFICATION", "COMPLETED"],
      };
    }

    const raffles = await db.raffle.findMany({
      where,
      include: {
        prizes: {
          orderBy: { rank: "asc" },
        },
        winners: {
          include: {
            user: {
              select: { name: true, image: true },
            },
            prize: true,
          },
        },
        _count: {
          select: {
            tickets: true,
            entries: true,
          },
        },
      },
      orderBy: [
        { isFeatured: "desc" },
        { status: "asc" },
        { endDate: "asc" },
      ],
    });

    return { raffles, error: null };
  } catch (error: any) {
    console.error("Failed to fetch public raffles:", error);
    return { raffles: [], error: error.message || "Failed to load raffles" };
  }
}

/**
 * Fetch featured raffles for homepage banner/slider
 */
export async function getHomepageRaffles() {
  try {
    const raffles = await db.raffle.findMany({
      where: {
        displayOnHomepage: true,
        status: { in: ["ACTIVE", "UPCOMING"] },
      },
      include: {
        prizes: {
          orderBy: { rank: "asc" },
        },
        _count: {
          select: {
            tickets: true,
          },
        },
      },
      orderBy: { endDate: "asc" },
      take: 4,
    });

    return { raffles, error: null };
  } catch (error: any) {
    console.error("Failed to fetch homepage raffles:", error);
    return { raffles: [], error: error.message || "Failed to load featured raffles" };
  }
}

/**
 * Fetch a single raffle by slug with complete details and user participation status
 */
export async function getRaffleDetails(slug: string) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    await autoUpdateRaffleStatuses();

    const raffle = await db.raffle.findUnique({
      where: { slug },
      include: {
        prizes: {
          orderBy: { rank: "asc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                basePrice: true,
                images: true,
              },
            },
          },
        },
        winners: {
          include: {
            prize: true,
            ticket: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!raffle) {
      return { raffle: null, error: "Raffle not found" };
    }

    let userParticipation = null;

    if (userId) {
      const [userEntries, userTickets, userWins] = await Promise.all([
        db.raffleEntry.findMany({
          where: { raffleId: raffle.id, userId },
          orderBy: { createdAt: "desc" },
        }),
        db.raffleTicket.findMany({
          where: { raffleId: raffle.id, userId },
          orderBy: { createdAt: "desc" },
        }),
        db.raffleWinner.findMany({
          where: { raffleId: raffle.id, userId },
          include: {
            prize: true,
            ticket: true,
          },
        }),
      ]);

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { isMember: true, membershipExpiry: true },
      });

      const isEligibleMember =
        raffle.visibility === "MEMBERS_ONLY"
          ? Boolean(user?.isMember && (!user.membershipExpiry || new Date(user.membershipExpiry) > new Date()))
          : true;

      userParticipation = {
        totalTickets: userTickets.length,
        entries: userEntries,
        tickets: userTickets,
        wins: userWins,
        isMember: user?.isMember || false,
        isEligibleMember,
        remainingAllowedEntries: Math.max(0, raffle.maxEntriesPerUser - userTickets.length),
      };
    }

    return {
      raffle,
      userParticipation,
      isLoggedIn: !!userId,
      error: null,
    };
  } catch (error: any) {
    console.error("Failed to fetch raffle details:", error);
    return { raffle: null, userParticipation: null, isLoggedIn: false, error: error.message };
  }
}

/**
 * Enter / Participate in a Raffle
 */
export async function enterRaffle(raffleId: string, ticketCount: number = 1) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Please log in to participate in the raffle." };
  }

  const userId = session.user.id;

  // Validate ticket count parameter
  if (!Number.isInteger(ticketCount) || ticketCount < 1 || ticketCount > 100) {
    return { success: false, error: "Invalid ticket count specified." };
  }

  // Rate limit: max 15 requests per 60s per user
  const rl = await consumeRateLimit("raffle-enter", userId, 15, 60);
  if (!rl.allowed) {
    return { success: false, error: "Too many participation requests. Please wait a moment." };
  }

  try {
    const raffle = await db.raffle.findUnique({
      where: { id: raffleId },
    });

    if (!raffle) {
      return { success: false, error: "Raffle not found." };
    }

    if (raffle.status !== "ACTIVE") {
      return { success: false, error: `This raffle is currently ${raffle.status.toLowerCase().replace("_", " ")}.` };
    }

    const now = new Date();
    if (now < new Date(raffle.startDate)) {
      return { success: false, error: "This raffle has not started yet." };
    }

    if (now > new Date(raffle.endDate)) {
      return { success: false, error: "This raffle has ended." };
    }

    // Check membership eligibility if restricted
    if (raffle.visibility === "MEMBERS_ONLY") {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { isMember: true, membershipExpiry: true },
      });

      const isMember = Boolean(user?.isMember && (!user.membershipExpiry || new Date(user.membershipExpiry) > now));
      if (!isMember) {
        return {
          success: false,
          error: "This raffle is exclusively for VIP Members. Please upgrade your membership to enter.",
        };
      }
    }

    if (ticketCount > 1 && !raffle.allowMultipleEntries) {
      return {
        success: false,
        error: "Multiple entries are not allowed for this raffle.",
      };
    }

    // Check paid status
    if (raffle.isPaid && raffle.entryPrice > 0) {
      return {
        success: false,
        error: "Paid-entry raffles are not currently open in this region.",
      };
    }

    // Execute atomic participation transaction with concurrency checks
    const result = await db.$transaction(async (tx) => {
      // Transactional advisory locks ensure strict serializability across parallel requests
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        `raffle:${raffle.id}:user:${userId}`
      );
      if (raffle.totalMaxEntries) {
        await tx.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext($1))",
          `raffle:${raffle.id}:campaign`
        );
      }

      // Re-fetch inside transaction for strict serializability
      const freshRaffle = await tx.raffle.findUnique({
        where: { id: raffle.id },
      });

      if (!freshRaffle || freshRaffle.status !== "ACTIVE") {
        throw new Error("This raffle is no longer accepting entries.");
      }

      // Check user ticket count inside transaction
      const currentUserTickets = await tx.raffleTicket.count({
        where: { raffleId: raffle.id, userId },
      });

      if (currentUserTickets + ticketCount > freshRaffle.maxEntriesPerUser) {
        throw new Error(
          `Entry limit reached. You can hold at most ${freshRaffle.maxEntriesPerUser} ticket${
            freshRaffle.maxEntriesPerUser > 1 ? "s" : ""
          } for this raffle (you currently have ${currentUserTickets}).`
        );
      }

      // Check total campaign cap inside transaction
      if (freshRaffle.totalMaxEntries && freshRaffle.totalTickets + ticketCount > freshRaffle.totalMaxEntries) {
        const remaining = Math.max(0, freshRaffle.totalMaxEntries - freshRaffle.totalTickets);
        throw new Error(`Only ${remaining} ticket${remaining === 1 ? "" : "s"} remain in this raffle.`);
      }

      // 1. Create RaffleEntry
      const entry = await tx.raffleEntry.create({
        data: {
          raffleId: raffle.id,
          userId,
          ticketCount,
          amountPaid: 0,
          paymentStatus: "FREE",
        },
      });

      // 2. Generate unique ticket numbers
      const generatedTickets: string[] = [];
      const prefix = (freshRaffle.slug.slice(0, 4) || "RAF").toUpperCase();
      const timestamp = Date.now().toString(36).toUpperCase();

      for (let i = 0; i < ticketCount; i++) {
        const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
        const ticketNumber = `CHS-${prefix}-${timestamp}-${randomHex}`;
        generatedTickets.push(ticketNumber);

        await tx.raffleTicket.create({
          data: {
            raffleId: freshRaffle.id,
            entryId: entry.id,
            userId,
            ticketNumber,
          },
        });
      }

      // 3. Count distinct participants
      const distinctUsers = await tx.raffleTicket.groupBy({
        by: ["userId"],
        where: { raffleId: freshRaffle.id },
      });

      const newTotalTickets = freshRaffle.totalTickets + ticketCount;
      const reachedCap = freshRaffle.totalMaxEntries && newTotalTickets >= freshRaffle.totalMaxEntries;

      // 4. Update raffle statistics
      await tx.raffle.update({
        where: { id: freshRaffle.id },
        data: {
          totalTickets: { increment: ticketCount },
          totalParticipants: distinctUsers.length,
          ...(reachedCap ? { status: "CLOSED" } : {}),
        },
      });

      return {
        entry,
        ticketNumbers: generatedTickets,
        totalUserTickets: currentUserTickets + ticketCount,
      };
    });

    revalidatePath(`/raffles/${raffle.slug}`);
    revalidatePath("/raffles");
    revalidatePath("/account/raffles");

    return {
      success: true,
      ticketNumbers: result.ticketNumbers,
      message: `Congratulations! You successfully obtained ${ticketCount} raffle ticket${
        ticketCount > 1 ? "s" : ""
      }!`,
    };
  } catch (error: any) {
    console.error("Failed to enter raffle:", error);
    return { success: false, error: error.message || "Failed to participate in the raffle." };
  }
}

/**
 * Fetch all raffles and entries for the logged-in customer's dashboard
 */
export async function getCustomerRaffleDashboard() {
  const session = await auth();
  if (!session?.user?.id) {
    return { data: null, error: "Unauthorized" };
  }

  const userId = session.user.id;

  try {
    await autoUpdateRaffleStatuses();

    // 1. All wins
    const wins = await db.raffleWinner.findMany({
      where: { userId },
      include: {
        prize: {
          include: {
            product: {
              select: { id: true, name: true, slug: true, images: true, basePrice: true },
            },
          },
        },
        raffle: true,
        ticket: true,
        order: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. All user tickets
    const tickets = await db.raffleTicket.findMany({
      where: { userId },
      include: {
        raffle: {
          include: {
            prizes: {
              orderBy: { rank: "asc" },
            },
          },
        },
        winner: {
          include: {
            prize: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group tickets by raffle
    const raffleMap = new Map<string, any>();
    tickets.forEach((t) => {
      if (!raffleMap.has(t.raffleId)) {
        raffleMap.set(t.raffleId, {
          raffle: t.raffle,
          tickets: [],
        });
      }
      raffleMap.get(t.raffleId).tickets.push(t);
    });

    const activeParticipations = Array.from(raffleMap.values()).filter(
      (p) => p.raffle.status === "ACTIVE" || p.raffle.status === "UPCOMING"
    );

    const pendingDrawParticipations = Array.from(raffleMap.values()).filter(
      (p) => p.raffle.status === "CLOSED" || p.raffle.status === "DRAW_PENDING"
    );

    const completedParticipations = Array.from(raffleMap.values()).filter((p) =>
      ["DRAW_COMPLETED", "WINNER_VERIFICATION", "COMPLETED"].includes(p.raffle.status)
    );

    // Also get saved user addresses for easy claiming
    const savedAddresses = await db.address.findMany({
      where: { userId },
      orderBy: { id: "desc" },
    });

    return {
      data: {
        wins,
        allTickets: tickets,
        activeParticipations,
        pendingDrawParticipations,
        completedParticipations,
        savedAddresses,
      },
      error: null,
    };
  } catch (error: any) {
    console.error("Failed to load customer raffle dashboard:", error);
    return { data: null, error: error.message || "Failed to load raffle dashboard" };
  }
}

/**
 * Prepare a raffle prize for standard storefront checkout.
 * Both free and paid product winners must go through checkout to confirm delivery address,
 * calculate standard Couriers Please shipping, and process required charges.
 */
export async function prepareRafflePrizeForCheckout(winnerId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Please log in to claim your prize." };
  }

  const userId = session.user.id;

  try {
    const winner = await db.raffleWinner.findUnique({
      where: { id: winnerId },
      include: {
        prize: {
          include: {
            product: {
              include: {
                productVariants: true,
              },
            },
          },
        },
        raffle: true,
      },
    });

    if (!winner) {
      return { success: false, error: "Winner record not found." };
    }

    if (winner.userId !== userId) {
      return { success: false, error: "Unauthorized: this winning record does not belong to your account." };
    }

    if (winner.status !== "PENDING_CLAIM") {
      return { success: false, error: "This winning prize has already been claimed or processed." };
    }

    let product = winner.prize.product;

    // If no product is directly linked to the prize, find an active product or create a designated promotional product
    if (!product) {
      if (winner.prize.productId) {
        product = await db.product.findUnique({
          where: { id: winner.prize.productId },
          include: { productVariants: true },
        });
      }

      if (!product) {
        const existingProduct = await db.product.findFirst({
          where: { isActive: true },
          include: { productVariants: true },
        });

        if (existingProduct) {
          await db.rafflePrize.update({
            where: { id: winner.prize.id },
            data: { productId: existingProduct.id },
          });
          product = existingProduct;
        } else {
          const firstCategory = await db.category.findFirst({ select: { id: true } });
          const newProduct = await db.product.create({
            data: {
              name: winner.prize.name,
              slug: `raffle-prize-${winner.prize.id.toLowerCase()}-${Date.now()}`,
              sku: `RP-${winner.prize.id.slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
              description: winner.prize.description || `Official prize for ${winner.raffle.title}`,
              basePrice: winner.prize.value,
              stock: 100,
              weight: 2,
              length: 20,
              width: 20,
              height: 20,
              images: winner.prize.images.length > 0 ? winner.prize.images : ["https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80"],
              isActive: true,
              categoryId: firstCategory?.id || "",
            },
            include: { productVariants: true },
          });
          await db.rafflePrize.update({
            where: { id: winner.prize.id },
            data: { productId: newProduct.id },
          });
          product = newProduct;
        }
      }
    }

    if (!product) {
      return { success: false, error: "Prize catalog item could not be resolved." };
    }

    // Ensure product has at least 1 in stock for the winner to claim
    if (product.stock < 1) {
      await db.product.update({
        where: { id: product.id },
        data: { stock: { increment: 5 } },
      });
      product.stock += 5;
    }

    const isFree = winner.prizeType === "FREE_PRODUCT";
    const winningPrice = isFree ? 0 : (winner.winningPrice || winner.prize.price || 0);

    const cartItem = {
      id: product.id,
      name: winner.prize.name,
      slug: product.slug,
      price: winningPrice,
      memberPrice: null,
      images: winner.prize.images.length > 0 ? winner.prize.images : product.images,
      stock: Math.max(product.stock, 1),
      description: winner.prize.description || product.description,
      variantId: winner.prize.productVariantId || null,
      variantLabel: isFree
        ? `🎉 Raffle Winner Free Gift (${winner.raffle.title})`
        : `🎉 Raffle Winner Exclusive Price $${winningPrice} (${winner.raffle.title})`,
      raffleWinnerId: winner.id,
      isRafflePrize: true,
    };

    return {
      success: true,
      winner: {
        id: winner.id,
        prizeType: winner.prizeType,
        winningPrice,
        prizeName: winner.prize.name,
        raffleTitle: winner.raffle.title,
      },
      cartItem,
    };
  } catch (err: any) {
    console.error("Failed to prepare raffle prize for checkout:", err);
    return { success: false, error: err.message || "Failed to prepare prize checkout." };
  }
}

/**
 * Deprecated direct prize claim.
 * Direct database order creation without checkout has been completely removed.
 * All raffle prize claims must proceed through the secure checkout flow.
 */
export async function claimFreePrize(_input: ClaimPrizeAddressInput) {
  return {
    success: false,
    error: "Direct prize claim is disabled. Please claim your prize via the secure checkout flow.",
  };
}

/**
 * Deprecated direct prize purchase.
 * Direct database order creation without checkout has been completely removed.
 * All raffle prize purchases must proceed through the secure checkout flow.
 */
export async function purchasePaidPrize(_winnerId: string, _addressId: string) {
  return {
    success: false,
    error: "Direct prize purchase is disabled. Please purchase your winning prize via the secure checkout flow.",
  };
}

/**
 * Helper to automatically transition raffle statuses based on current timestamp
 */
export async function autoUpdateRaffleStatuses() {
  const now = new Date();

  try {
    // 1. Move UPCOMING to ACTIVE when startDate arrives
    await db.raffle.updateMany({
      where: {
        status: "UPCOMING",
        startDate: { lte: now },
        endDate: { gt: now },
      },
      data: { status: "ACTIVE" },
    });

    // 2. Move ACTIVE to CLOSED / DRAW_PENDING when endDate arrives
    await db.raffle.updateMany({
      where: {
        status: "ACTIVE",
        endDate: { lte: now },
        automaticClosure: true,
      },
      data: { status: "DRAW_PENDING" },
    });
  } catch (err) {
    // Non-blocking catch
    console.warn("Auto-update raffle statuses error:", err);
  }
}

