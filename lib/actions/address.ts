"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { addressSchema, AddressInput } from "@/lib/validations/address";
import { revalidatePath } from "next/cache";

export async function getAddresses(): Promise<{ addresses: Awaited<ReturnType<typeof db.address.findMany>>; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { addresses: [] };
  }

  try {
    const addresses = await db.address.findMany({
      where: { userId: session.user.id },
      orderBy: { id: "desc" },
    });

    return { addresses };
  } catch (error) {
    console.error("Failed to fetch addresses:", error);
    // Return empty array to prevent UI from breaking — user can still enter address inline
    return { addresses: [] };
  }
}

export async function createAddress(data: AddressInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const validated = addressSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    const address = await db.address.create({
      data: {
        userId: session.user.id,
        name: validated.data.name,
        phone: validated.data.phone,
        line1: validated.data.line1,
        line2: validated.data.line2 || null,
        suburb: validated.data.suburb,
        state: validated.data.state,
        postcode: validated.data.postcode,
        country: validated.data.country || "AU",
      },
    });

    revalidatePath("/account/addresses");
    revalidatePath("/account/dashboard");
    revalidatePath("/checkout");
    return { success: true, address };
  } catch (error) {
    console.error("Failed to create address:", error);
    return { error: "Failed to create address" };
  }
}

export async function updateAddress(id: string, data: AddressInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const validated = addressSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    // Verify ownership
    const existing = await db.address.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return { error: "Address not found" };
    }

    const address = await db.address.update({
      where: { id },
      data: {
        name: validated.data.name,
        phone: validated.data.phone,
        line1: validated.data.line1,
        line2: validated.data.line2 || null,
        suburb: validated.data.suburb,
        state: validated.data.state,
        postcode: validated.data.postcode,
        country: validated.data.country || "AU",
      },
    });

    revalidatePath("/account/addresses");
    revalidatePath("/account/dashboard");
    revalidatePath("/checkout");
    return { success: true, address };
  } catch (error) {
    console.error("Failed to update address:", error);
    return { error: "Failed to update address" };
  }
}

export async function deleteAddress(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  try {
    // Verify ownership
    const existing = await db.address.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return { error: "Address not found" };
    }

    await db.address.delete({ where: { id } });

    revalidatePath("/account/addresses");
    revalidatePath("/account/dashboard");
    revalidatePath("/checkout");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete address:", error);
    return { error: "Failed to delete address" };
  }
}
