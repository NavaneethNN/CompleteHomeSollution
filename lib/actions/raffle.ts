"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claimPrizeAddressSchema, ClaimPrizeAddressInput } from "@/lib/validations/raffle";
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
    const now = new Date();
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

  try {
    const raffle = await db.raffle.findUnique({
      where: { id: raffleId },
      include: {
        tickets: {
          where: { userId },
        },
      },
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

    // Check per-user ticket limit
    const existingTicketCount = raffle.tickets.length;
    if (existingTicketCount + ticketCount > raffle.maxEntriesPerUser) {
      return {
        success: false,
        error: `Limit reached. You can have at most ${raffle.maxEntriesPerUser} ticket${
          raffle.maxEntriesPerUser > 1 ? "s" : ""
        } for this raffle. (You currently have ${existingTicketCount}).`,
      };
    }

    // Check total campaign max entries
    if (raffle.totalMaxEntries && raffle.totalTickets + ticketCount > raffle.totalMaxEntries) {
      const remaining = Math.max(0, raffle.totalMaxEntries - raffle.totalTickets);
      return {
        success: false,
        error: `Only ${remaining} ticket${remaining === 1 ? "" : "s"} remain in this raffle.`,
      };
    }

    // Check paid status
    if (raffle.isPaid && raffle.entryPrice > 0) {
      return {
        success: false,
        error: "Paid-entry raffles are not currently open in this region.",
      };
    }

    // Execute atomic participation transaction
    const result = await db.$transaction(async (tx) => {
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
      const prefix = raffle.slug.slice(0, 4).toUpperCase();
      const timestamp = Date.now().toString(36).toUpperCase();

      for (let i = 0; i < ticketCount; i++) {
        const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
        const ticketNumber = `CHS-${prefix}-${timestamp}-${randomHex}`;
        generatedTickets.push(ticketNumber);

        await tx.raffleTicket.create({
          data: {
            raffleId: raffle.id,
            entryId: entry.id,
            userId,
            ticketNumber,
          },
        });
      }

      // 3. Count distinct participants
      const distinctUsers = await tx.raffleTicket.groupBy({
        by: ["userId"],
        where: { raffleId: raffle.id },
      });

      // 4. Update raffle statistics
      const updatedRaffle = await tx.raffle.update({
        where: { id: raffle.id },
        data: {
          totalTickets: { increment: ticketCount },
          totalParticipants: distinctUsers.length,
          // If totalMaxEntries reached, update status to CLOSED
          ...(raffle.totalMaxEntries && raffle.totalTickets + ticketCount >= raffle.totalMaxEntries
            ? { status: "CLOSED" }
            : {}),
        },
      });

      return {
        entry,
        ticketNumbers: generatedTickets,
        totalUserTickets: existingTicketCount + ticketCount,
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
 * Claim Free Prize with Shipping Address
 */
export async function claimFreePrize(input: ClaimPrizeAddressInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;

  const validated = claimPrizeAddressSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const data = validated.data;

  try {
    const winner = await db.raffleWinner.findUnique({
      where: { id: data.winnerId },
      include: {
        prize: true,
        raffle: true,
      },
    });

    if (!winner) {
      return { success: false, error: "Winning record not found." };
    }

    if (winner.userId !== userId) {
      return { success: false, error: "Unauthorized claim attempt." };
    }

    if (winner.status === "CLAIMED") {
      return { success: false, error: "This prize has already been claimed!" };
    }

    if (winner.prizeType !== "FREE_PRODUCT") {
      return { success: false, error: "This prize requires checkout purchase." };
    }

    const addressSnapshot = {
      name: data.name,
      phone: data.phone,
      line1: data.line1,
      line2: data.line2 || null,
      suburb: data.suburb,
      state: data.state,
      postcode: data.postcode,
      country: data.country || "AU",
    };

    // Optionally save to profile
    if (data.saveToProfile) {
      await db.address.create({
        data: {
          userId,
          name: data.name,
          phone: data.phone,
          line1: data.line1,
          line2: data.line2 || null,
          suburb: data.suburb,
          state: data.state,
          postcode: data.postcode,
          country: data.country || "AU",
        },
      });
    }

    // Update winner record
    const updated = await db.raffleWinner.update({
      where: { id: winner.id },
      data: {
        status: "CLAIMED",
        claimedAt: new Date(),
        shippingAddress: addressSnapshot,
        deliveryStatus: "PROCESSING",
      },
    });

    // Add audit log
    await db.raffleAuditLog.create({
      data: {
        raffleId: winner.raffleId,
        adminId: userId,
        action: "PRIZE_CLAIMED_BY_WINNER",
        details: {
          winnerId: winner.id,
          prizeName: winner.prize.name,
          shippingAddress: addressSnapshot,
        },
      },
    });

    revalidatePath("/account/raffles");
    revalidatePath(`/raffles/${winner.raffle.slug}`);

    return {
      success: true,
      message: "Prize claimed successfully! We will prepare and dispatch your gift to the provided address.",
    };
  } catch (error: any) {
    console.error("Failed to claim free prize:", error);
    return { success: false, error: error.message || "Failed to submit prize claim." };
  }
}

/**
 * Purchase a Paid/Discounted Winning Prize at the special price
 */
export async function purchasePaidPrize(winnerId: string, addressId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;

  try {
    const winner = await db.raffleWinner.findUnique({
      where: { id: winnerId },
      include: {
        prize: {
          include: { product: true },
        },
        raffle: true,
      },
    });

    if (!winner) {
      return { success: false, error: "Winner record not found." };
    }

    if (winner.userId !== userId) {
      return { success: false, error: "Unauthorized purchase attempt." };
    }

    if (winner.status === "CLAIMED") {
      return { success: false, error: "This winning prize has already been purchased!" };
    }

    const address = await db.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      return { success: false, error: "Shipping address not found." };
    }

    const winningPrice = winner.winningPrice || winner.prize.price || 0;

    // Create an order in CONFIRMED / PROCESSING status for this prize
    const order = await db.$transaction(async (tx) => {
      // Find or create a product placeholder if no productId is linked
      let productId = winner.prize.productId;
      if (!productId) {
        // Find existing product or create default
        const existingProd = await tx.product.findFirst({
          select: { id: true },
        });
        productId = existingProd?.id || "";
      }

      const newOrder = await tx.order.create({
        data: {
          userId,
          status: "CONFIRMED",
          addressId: address.id,
          subtotal: winningPrice,
          shippingCost: 0,
          tax: 0,
          discount: 0,
          total: winningPrice,
          ...(productId
            ? {
                items: {
                  create: {
                    productId,
                    productVariantId: winner.prize.productVariantId || null,
                    quantity: 1,
                    unitPrice: winningPrice,
                    variantSummary: `Raffle Winner Prize (${winner.raffle.title})`,
                  },
                },
              }
            : {}),
        },
      });

      // Update winner
      await tx.raffleWinner.update({
        where: { id: winner.id },
        data: {
          status: "CLAIMED",
          claimedAt: new Date(),
          orderId: newOrder.id,
          shippingAddressId: address.id,
          shippingAddress: {
            name: address.name,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            suburb: address.suburb,
            state: address.state,
            postcode: address.postcode,
            country: address.country,
          },
          deliveryStatus: "PROCESSING",
        },
      });

      return newOrder;
    });

    revalidatePath("/account/raffles");
    revalidatePath("/account/orders");
    revalidatePath(`/raffles/${winner.raffle.slug}`);

    return {
      success: true,
      orderId: order.id,
      message: `Congratulations! Your winning prize order (#${order.id.slice(-6)}) has been placed successfully!`,
    };
  } catch (error: any) {
    console.error("Failed to purchase prize:", error);
    return { success: false, error: error.message || "Failed to process prize purchase." };
  }
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
