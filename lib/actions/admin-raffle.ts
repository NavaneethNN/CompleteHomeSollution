"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import {
  raffleFormSchema,
  RaffleFormData,
  raffleFulfilmentSchema,
  RaffleFulfilmentInput,
} from "@/lib/validations/raffle";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

async function requireAdmin() {
  const isAdmin = await hasFreshAdminSession();
  if (!isAdmin) {
    throw new Error("Unauthorized. Admin privileges required.");
  }
  const session = await auth();
  return session?.user?.id || "admin";
}

/**
 * List all raffles for Admin management
 */
export async function getAdminRaffles(search?: string, statusFilter?: string) {
  try {
    await requireAdmin();

    const where: any = {};
    if (statusFilter && statusFilter !== "ALL") {
      where.status = statusFilter;
    }
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { slug: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const raffles = await db.raffle.findMany({
      where,
      include: {
        prizes: {
          orderBy: { rank: "asc" },
        },
        winners: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            prize: true,
          },
        },
        _count: {
          select: {
            tickets: true,
            entries: true,
            winners: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { raffles, error: null };
  } catch (error: any) {
    console.error("Failed to fetch admin raffles:", error);
    return { raffles: [], error: error.message };
  }
}

/**
 * Get full raffle details for Admin management / draw console
 */
export async function getAdminRaffleById(id: string) {
  try {
    await requireAdmin();

    const raffle = await db.raffle.findUnique({
      where: { id },
      include: {
        prizes: {
          orderBy: { rank: "asc" },
          include: {
            product: {
              select: { id: true, name: true, images: true, basePrice: true },
            },
          },
        },
        entries: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        tickets: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        winners: {
          include: {
            prize: true,
            ticket: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
            order: true,
          },
          orderBy: { rank: "asc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: {
          select: {
            tickets: true,
            entries: true,
            winners: true,
          },
        },
      },
    });

    if (!raffle) {
      return { raffle: null, error: "Raffle not found" };
    }

    return { raffle, error: null };
  } catch (error: any) {
    console.error("Failed to fetch admin raffle:", error);
    return { raffle: null, error: error.message };
  }
}

/**
 * Create a new Raffle with multiple prizes
 */
export async function createRaffle(data: RaffleFormData) {
  try {
    const adminId = await requireAdmin();

    const validated = raffleFormSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const { prizes, startDate, endDate, drawDate, ...raffleData } = validated.data;

    // Check slug uniqueness
    const existing = await db.raffle.findUnique({
      where: { slug: raffleData.slug },
    });
    if (existing) {
      return { success: false, error: "A raffle with this URL slug already exists. Please pick a unique slug." };
    }

    const raffle = await db.$transaction(async (tx) => {
      const createdRaffle = await tx.raffle.create({
        data: {
          ...raffleData,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          drawDate: new Date(drawDate),
          prizes: {
            create: prizes.map((prize, idx) => ({
              rank: prize.rank || idx + 1,
              name: prize.name,
              description: prize.description || null,
              images: prize.images || [],
              value: prize.value || 0,
              prizeType: prize.prizeType,
              price: prize.prizeType === "FREE_PRODUCT" ? 0 : prize.price || 0,
              quantity: prize.quantity || 1,
              productId: prize.productId || null,
              productVariantId: prize.productVariantId || null,
            })),
          },
        },
      });

      await tx.raffleAuditLog.create({
        data: {
          raffleId: createdRaffle.id,
          adminId,
          action: "RAFFLE_CREATED",
          details: { title: createdRaffle.title, prizesCount: prizes.length },
        },
      });

      return createdRaffle;
    });

    revalidatePath("/admin/raffles");
    revalidatePath("/raffles");

    return { success: true, raffleId: raffle.id, message: "Raffle campaign created successfully!" };
  } catch (error: any) {
    console.error("Failed to create raffle:", error);
    return { success: false, error: error.message || "Failed to create raffle." };
  }
}

/**
 * Update an existing Raffle and its prizes
 */
export async function updateRaffle(id: string, data: RaffleFormData) {
  try {
    const adminId = await requireAdmin();

    const validated = raffleFormSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const { prizes, startDate, endDate, drawDate, ...raffleData } = validated.data;

    const existing = await db.raffle.findUnique({
      where: { id },
      include: { prizes: true },
    });

    if (!existing) {
      return { success: false, error: "Raffle not found" };
    }

    // Slug check if changed
    if (raffleData.slug !== existing.slug) {
      const slugConflict = await db.raffle.findUnique({
        where: { slug: raffleData.slug },
      });
      if (slugConflict && slugConflict.id !== id) {
        return { success: false, error: "Another raffle with this slug already exists." };
      }
    }

    await db.$transaction(async (tx) => {
      // Delete old prizes and recreate with updated config
      await tx.rafflePrize.deleteMany({
        where: { raffleId: id },
      });

      await tx.raffle.update({
        where: { id },
        data: {
          ...raffleData,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          drawDate: new Date(drawDate),
          prizes: {
            create: prizes.map((prize, idx) => ({
              rank: prize.rank || idx + 1,
              name: prize.name,
              description: prize.description || null,
              images: prize.images || [],
              value: prize.value || 0,
              prizeType: prize.prizeType,
              price: prize.prizeType === "FREE_PRODUCT" ? 0 : prize.price || 0,
              quantity: prize.quantity || 1,
              productId: prize.productId || null,
              productVariantId: prize.productVariantId || null,
            })),
          },
        },
      });

      await tx.raffleAuditLog.create({
        data: {
          raffleId: id,
          adminId,
          action: "RAFFLE_UPDATED",
          details: { title: raffleData.title, prizesCount: prizes.length },
        },
      });
    });

    revalidatePath("/admin/raffles");
    revalidatePath(`/admin/raffles/${id}`);
    revalidatePath("/raffles");
    revalidatePath(`/raffles/${raffleData.slug}`);

    return { success: true, message: "Raffle campaign updated successfully!" };
  } catch (error: any) {
    console.error("Failed to update raffle:", error);
    return { success: false, error: error.message || "Failed to update raffle." };
  }
}

/**
 * Quick status change (Publish, Pause, Resume, Close)
 */
export async function updateRaffleStatus(id: string, status: any) {
  try {
    const adminId = await requireAdmin();

    const raffle = await db.raffle.findUnique({ where: { id } });
    if (!raffle) {
      return { success: false, error: "Raffle not found." };
    }

    await db.raffle.update({
      where: { id },
      data: { status },
    });

    await db.raffleAuditLog.create({
      data: {
        raffleId: id,
        adminId,
        action: `STATUS_CHANGED_TO_${status}`,
        details: { previousStatus: raffle.status, newStatus: status },
      },
    });

    revalidatePath("/admin/raffles");
    revalidatePath(`/admin/raffles/${id}`);
    revalidatePath("/raffles");

    return { success: true, message: `Raffle status updated to ${status}.` };
  } catch (error: any) {
    console.error("Failed to update status:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Conduct auditable random winner draw for all prizes in the raffle
 */
export async function conductRaffleDraw(
  raffleId: string,
  options: { allowMultipleWinsPerUser?: boolean } = { allowMultipleWinsPerUser: false }
) {
  try {
    const adminId = await requireAdmin();

    const raffle = await db.raffle.findUnique({
      where: { id: raffleId },
      include: {
        prizes: { orderBy: { rank: "asc" } },
        tickets: true,
        winners: true,
      },
    });

    if (!raffle) {
      return { success: false, error: "Raffle not found." };
    }

    if (raffle.tickets.length === 0) {
      return { success: false, error: "Cannot conduct draw: No participants have entered this raffle yet." };
    }

    if (raffle.prizes.length === 0) {
      return { success: false, error: "Cannot conduct draw: No prizes configured for this raffle." };
    }

    // Cryptographic audit seed
    const drawSeed = crypto.randomBytes(32).toString("hex");

    // Shuffle tickets securely
    const ticketsPool = [...raffle.tickets];
    for (let i = ticketsPool.length - 1; i > 0; i--) {
      const randomBuffer = crypto.randomBytes(4);
      const randomFloat = randomBuffer.readUInt32BE(0) / 0xffffffff;
      const j = Math.floor(randomFloat * (i + 1));
      [ticketsPool[i], ticketsPool[j]] = [ticketsPool[j], ticketsPool[i]];
    }

    // Assign winners to prizes in rank order
    const winnersToCreate: Array<{
      raffleId: string;
      prizeId: string;
      ticketId: string;
      userId: string;
      rank: number;
      prizeType: any;
      winningPrice: number;
      status: any;
    }> = [];

    const winningTicketIds = new Set<string>();
    const winningUserIds = new Set<string>();

    for (const prize of raffle.prizes) {
      let winnersAssignedForPrize = 0;

      for (const ticket of ticketsPool) {
        if (winnersAssignedForPrize >= prize.quantity) break;

        // Skip if ticket already won
        if (winningTicketIds.has(ticket.id)) continue;

        // If multiple wins per user not allowed, skip user if they already won an earlier prize
        if (!options.allowMultipleWinsPerUser && winningUserIds.has(ticket.userId)) {
          // If total distinct users is less than total prizes, relax restriction
          const totalDistinctUsers = new Set(raffle.tickets.map((t) => t.userId)).size;
          const totalPrizeSlots = raffle.prizes.reduce((sum, p) => sum + p.quantity, 0);
          if (totalDistinctUsers >= totalPrizeSlots) {
            continue;
          }
        }

        winningTicketIds.add(ticket.id);
        winningUserIds.add(ticket.userId);
        winnersAssignedForPrize++;

        winnersToCreate.push({
          raffleId: raffle.id,
          prizeId: prize.id,
          ticketId: ticket.id,
          userId: ticket.userId,
          rank: prize.rank,
          prizeType: prize.prizeType,
          winningPrice: prize.prizeType === "FREE_PRODUCT" ? 0 : prize.price,
          status: "PENDING_CLAIM",
        });
      }
    }

    if (winnersToCreate.length === 0) {
      return { success: false, error: "Unable to assign winners from the available tickets." };
    }

    await db.$transaction(async (tx) => {
      // Clear any prior draft winners if redrawing
      await tx.raffleWinner.deleteMany({
        where: { raffleId: raffle.id },
      });

      // Insert selected winners
      for (const w of winnersToCreate) {
        await tx.raffleWinner.create({
          data: w,
        });
      }

      // Update raffle status to WINNER_VERIFICATION (ready for admin approval)
      await tx.raffle.update({
        where: { id: raffle.id },
        data: {
          status: "WINNER_VERIFICATION",
          drawSeed,
          drawNotes: `Draw executed at ${new Date().toISOString()} by admin ${adminId}. Selected ${
            winnersToCreate.length
          } winner(s).`,
        },
      });

      await tx.raffleAuditLog.create({
        data: {
          raffleId: raffle.id,
          adminId,
          action: "DRAW_EXECUTED",
          details: {
            drawSeed,
            totalWinners: winnersToCreate.length,
            winnerTicketIds: Array.from(winningTicketIds),
          },
        },
      });
    });

    revalidatePath(`/admin/raffles/${raffleId}`);
    revalidatePath("/admin/raffles");
    revalidatePath(`/raffles/${raffle.slug}`);

    return {
      success: true,
      winnersCount: winnersToCreate.length,
      drawSeed,
      message: `Draw executed successfully! ${winnersToCreate.length} winner(s) selected for verification.`,
    };
  } catch (error: any) {
    console.error("Failed to conduct draw:", error);
    return { success: false, error: error.message || "Failed to execute draw." };
  }
}

/**
 * Approve and announce winners publicly
 */
export async function approveAndAnnounceWinners(raffleId: string) {
  try {
    const adminId = await requireAdmin();

    const raffle = await db.raffle.findUnique({
      where: { id: raffleId },
      include: { winners: true },
    });

    if (!raffle) {
      return { success: false, error: "Raffle not found." };
    }

    if (raffle.winners.length === 0) {
      return { success: false, error: "No winners have been selected yet. Conduct the draw first." };
    }

    await db.$transaction(async (tx) => {
      await tx.raffle.update({
        where: { id: raffleId },
        data: {
          status: "COMPLETED",
          winnersAnnounced: true,
        },
      });

      await tx.raffleAuditLog.create({
        data: {
          raffleId,
          adminId,
          action: "WINNERS_ANNOUNCED",
          details: { winnersCount: raffle.winners.length },
        },
      });
    });

    revalidatePath(`/admin/raffles/${raffleId}`);
    revalidatePath("/admin/raffles");
    revalidatePath(`/raffles/${raffle.slug}`);
    revalidatePath("/account/raffles");

    return {
      success: true,
      message: "Winners announced successfully! Customer claims and prize purchases are now live.",
    };
  } catch (error: any) {
    console.error("Failed to approve winners:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Disqualify / Replace a winner if verification fails
 */
export async function redrawSingleWinner(winnerId: string, reason: string) {
  try {
    const adminId = await requireAdmin();

    const winner = await db.raffleWinner.findUnique({
      where: { id: winnerId },
      include: {
        raffle: {
          include: {
            tickets: true,
            winners: true,
          },
        },
        prize: true,
      },
    });

    if (!winner) {
      return { success: false, error: "Winner not found." };
    }

    const currentWinnerTicketIds = new Set(winner.raffle.winners.map((w) => w.ticketId));
    const eligibleTickets = winner.raffle.tickets.filter((t) => !currentWinnerTicketIds.has(t.id));

    if (eligibleTickets.length === 0) {
      return { success: false, error: "No remaining eligible tickets available for redraw." };
    }

    // Pick random ticket
    const randomIndex = Math.floor(Math.random() * eligibleTickets.length);
    const newWinningTicket = eligibleTickets[randomIndex];

    await db.$transaction(async (tx) => {
      // Update winner record with new ticket and user
      await tx.raffleWinner.update({
        where: { id: winner.id },
        data: {
          ticketId: newWinningTicket.id,
          userId: newWinningTicket.userId,
          status: "PENDING_CLAIM",
          claimedAt: null,
          shippingAddress: Prisma.DbNull,
          notes: `Replaced previous winner (${winner.userId}) due to: ${reason}`,
        },
      });

      await tx.raffleAuditLog.create({
        data: {
          raffleId: winner.raffleId,
          adminId,
          action: "WINNER_REDRAWN",
          details: {
            previousWinnerId: winner.userId,
            newWinnerId: newWinningTicket.userId,
            newTicketId: newWinningTicket.id,
            reason,
          },
        },
      });
    });

    revalidatePath(`/admin/raffles/${winner.raffleId}`);
    return { success: true, message: "Winner replacement selected successfully." };
  } catch (error: any) {
    console.error("Failed to redraw winner:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update prize fulfilment / shipping details
 */
export async function updatePrizeFulfilment(input: RaffleFulfilmentInput) {
  try {
    const adminId = await requireAdmin();

    const validated = raffleFulfilmentSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const { winnerId, carrier, trackingNumber, deliveryStatus, notes } = validated.data;

    const winner = await db.raffleWinner.findUnique({
      where: { id: winnerId },
    });

    if (!winner) {
      return { success: false, error: "Winner record not found." };
    }

    const isShipped = deliveryStatus === "SHIPPED";
    const isDelivered = deliveryStatus === "DELIVERED";

    await db.raffleWinner.update({
      where: { id: winnerId },
      data: {
        carrier: carrier || null,
        trackingNumber: trackingNumber || null,
        deliveryStatus,
        notes: notes || null,
        ...(isShipped && !winner.shippedAt ? { shippedAt: new Date() } : {}),
        ...(isDelivered && !winner.deliveredAt ? { deliveredAt: new Date() } : {}),
      },
    });

    await db.raffleAuditLog.create({
      data: {
        raffleId: winner.raffleId,
        adminId,
        action: "FULFILMENT_UPDATED",
        details: { winnerId, carrier, trackingNumber, deliveryStatus },
      },
    });

    revalidatePath(`/admin/raffles/${winner.raffleId}`);
    revalidatePath("/account/raffles");

    return { success: true, message: "Fulfilment and tracking updated successfully!" };
  } catch (error: any) {
    console.error("Failed to update fulfilment:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a draft or empty raffle
 */
export async function deleteRaffle(id: string) {
  try {
    const adminId = await requireAdmin();

    const raffle = await db.raffle.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });

    if (!raffle) {
      return { success: false, error: "Raffle not found." };
    }

    if (raffle._count.entries > 0 && raffle.status !== "DRAFT" && raffle.status !== "CANCELLED") {
      return {
        success: false,
        error: "Cannot delete a raffle with active participants. Please Cancel or Close the campaign instead.",
      };
    }

    await db.raffle.delete({ where: { id } });

    revalidatePath("/admin/raffles");
    revalidatePath("/raffles");

    return { success: true, message: "Raffle deleted successfully." };
  } catch (error: any) {
    console.error("Failed to delete raffle:", error);
    return { success: false, error: error.message };
  }
}
