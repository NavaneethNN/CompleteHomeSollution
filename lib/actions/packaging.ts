"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { DEFAULT_PACKAGING_PRESETS } from "@/lib/packaging";

const presetSchema = z.object({
  name: z.string().trim().min(1, "Package name is required").max(60),
  length: z.coerce.number().positive("Length must be greater than 0"),
  width: z.coerce.number().positive("Breadth must be greater than 0"),
  height: z.coerce.number().positive("Height must be greater than 0"),
  maxWeight: z.coerce.number().positive("Max weight must be greater than 0"),
  emptyWeight: z.coerce.number().min(0, "Empty box weight cannot be negative"),
  priority: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export async function getPackagingPresets() {
  const isAdmin = await hasFreshAdminSession();
  if (!isAdmin) {
    return { success: false, error: "Unauthorized", presets: [] };
  }

  try {
    const presets = await db.packagingPreset.findMany({
      orderBy: [{ priority: "desc" }, { maxWeight: "asc" }, { name: "asc" }],
    });

    return { success: true, presets };
  } catch (error) {
    console.error("[getPackagingPresets]", error);
    return { success: false, error: "Failed to load packaging presets", presets: [] };
  }
}

export async function createPackagingPreset(formData: z.infer<typeof presetSchema>) {
  const isAdmin = await hasFreshAdminSession();
  if (!isAdmin) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = presetSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const created = await db.packagingPreset.create({
      data: parsed.data,
    });
    revalidatePath("/admin/packaging");
    revalidatePath("/admin/orders");
    return { success: true, preset: created };
  } catch (error) {
    console.error("[createPackagingPreset]", error);
    return { success: false, error: "Failed to create packaging preset" };
  }
}

export async function updatePackagingPreset(id: string, formData: Partial<z.infer<typeof presetSchema>>) {
  const isAdmin = await hasFreshAdminSession();
  if (!isAdmin) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const updated = await db.packagingPreset.update({
      where: { id },
      data: formData,
    });
    revalidatePath("/admin/packaging");
    revalidatePath("/admin/orders");
    return { success: true, preset: updated };
  } catch (error) {
    console.error("[updatePackagingPreset]", error);
    return { success: false, error: "Failed to update packaging preset" };
  }
}

export async function togglePackagingPresetActive(id: string, isActive: boolean) {
  const isAdmin = await hasFreshAdminSession();
  if (!isAdmin) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.packagingPreset.update({
      where: { id },
      data: { isActive },
    });
    revalidatePath("/admin/packaging");
    return { success: true };
  } catch (error) {
    console.error("[togglePackagingPresetActive]", error);
    return { success: false, error: "Failed to toggle preset status" };
  }
}

export async function deletePackagingPreset(id: string) {
  const isAdmin = await hasFreshAdminSession();
  if (!isAdmin) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.packagingPreset.delete({
      where: { id },
    });
    revalidatePath("/admin/packaging");
    return { success: true };
  } catch (error) {
    console.error("[deletePackagingPreset]", error);
    return { success: false, error: "Failed to delete packaging preset" };
  }
}

export async function seedDefaultPackagingPresets() {
  const isAdmin = await hasFreshAdminSession();
  if (!isAdmin) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    for (const preset of DEFAULT_PACKAGING_PRESETS) {
      const existing = await db.packagingPreset.findFirst({
        where: { name: preset.name },
      });
      if (!existing) {
        await db.packagingPreset.create({
          data: preset,
        });
      }
    }
    revalidatePath("/admin/packaging");
    return { success: true };
  } catch (error) {
    console.error("[seedDefaultPackagingPresets]", error);
    return { success: false, error: "Failed to seed default presets" };
  }
}

const updateOrderPackagingSchema = z.object({
  orderId: z.string().min(1),
  packagePresetId: z.string().nullable().optional(),
  packageName: z.string().trim().min(1, "Package name is required"),
  packedLength: z.coerce.number().positive("Length must be > 0"),
  packedWidth: z.coerce.number().positive("Width must be > 0"),
  packedHeight: z.coerce.number().positive("Height must be > 0"),
  packedWeight: z.coerce.number().positive("Weight must be > 0"),
  packageOverride: z.boolean().default(true),
});

export async function updateOrderPackaging(input: z.infer<typeof updateOrderPackagingSchema>) {
  const isAdmin = await hasFreshAdminSession();
  if (!isAdmin) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateOrderPackagingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const {
    orderId,
    packagePresetId,
    packageName,
    packedLength,
    packedWidth,
    packedHeight,
    packedWeight,
    packageOverride,
  } = parsed.data;

  try {
    await db.order.update({
      where: { id: orderId },
      data: {
        packagePresetId: packagePresetId || null,
        packageName,
        packedLength,
        packedWidth,
        packedHeight,
        packedWeight,
        packageOverride: packageOverride ?? true,
      },
    });

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/admin/orders`);
    return { success: true };
  } catch (error) {
    console.error("[updateOrderPackaging]", error);
    return { success: false, error: "Failed to update order packaging" };
  }
}

