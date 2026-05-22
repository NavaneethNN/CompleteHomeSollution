"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");
}

// ── Types ───────────────────────────────────────────────────────────────────

export type MembershipPlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  discountPercent: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { users?: number };
};

export type MemberUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isMember: boolean;
  memberSince: Date | null;
  createdAt: Date;
  _count: { orders: number };
};

// ── Plan CRUD ───────────────────────────────────────────────────────────────

const planSchema = z.object({
  name:            z.string().min(1).max(80),
  description:     z.string().max(500).optional().nullable(),
  price:           z.number().positive(),
  durationDays:    z.number().int().positive(),
  discountPercent: z.number().min(0).max(100),
  isActive:        z.boolean(),
  isDefault:       z.boolean(),
});

export type PlanInput = z.infer<typeof planSchema>;
export type PlanResult = { success?: boolean; error?: string };

export async function getPlans(): Promise<MembershipPlan[]> {
  await requireAdmin();
  return db.membershipPlan.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createPlan(input: PlanInput): Promise<PlanResult> {
  await requireAdmin();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = parsed.data;

  // If marking as default, unset any existing default first
  if (data.isDefault) {
    await db.membershipPlan.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  await db.membershipPlan.create({ data });
  revalidatePath("/admin/membership");
  return { success: true };
}

export async function updatePlan(id: string, input: PlanInput): Promise<PlanResult> {
  await requireAdmin();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = parsed.data;

  if (data.isDefault) {
    await db.membershipPlan.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  await db.membershipPlan.update({ where: { id }, data });
  revalidatePath("/admin/membership");
  return { success: true };
}

export async function deletePlan(id: string): Promise<PlanResult> {
  await requireAdmin();
  await db.membershipPlan.delete({ where: { id } });
  revalidatePath("/admin/membership");
  return { success: true };
}

export async function setDefaultPlan(id: string): Promise<PlanResult> {
  await requireAdmin();
  await db.membershipPlan.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  await db.membershipPlan.update({ where: { id }, data: { isDefault: true } });
  revalidatePath("/admin/membership");
  return { success: true };
}

// ── Members list ────────────────────────────────────────────────────────────

export async function getMembers(): Promise<MemberUser[]> {
  await requireAdmin();
  return db.user.findMany({
    where: { isMember: true },
    select: {
      id: true, name: true, email: true, image: true,
      isMember: true, memberSince: true, createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { memberSince: "desc" },
  });
}

export async function revokeMembership(userId: string): Promise<PlanResult> {
  await requireAdmin();
  await db.user.update({
    where: { id: userId },
    data: { isMember: false, memberSince: null },
  });
  revalidatePath("/admin/membership");
  return { success: true };
}

export async function grantMembership(userId: string): Promise<PlanResult> {
  await requireAdmin();
  await db.user.update({
    where: { id: userId },
    data: { isMember: true, memberSince: new Date() },
  });
  revalidatePath("/admin/membership");
  return { success: true };
}
