"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profileSchema, ProfileInput } from "@/lib/validations/address";
import { revalidatePath } from "next/cache";

export async function updateProfile(data: ProfileInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const validated = profileSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: validated.data.name,
        phone: validated.data.phone || null,
        image: validated.data.image || null,
      },
    });

    revalidatePath("/account/dashboard");
    revalidatePath("/account/profile");
    return { success: true };
  } catch (error) {
    console.error("Failed to update profile:", error);
    return { error: "Failed to update profile" };
  }
}

export async function getProfile() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        isMember: true,
        memberSince: true,
        createdAt: true,
      },
    });

    return user;
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return null;
  }
}
