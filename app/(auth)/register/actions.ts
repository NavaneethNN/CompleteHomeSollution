"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name must be 60 characters or less"),
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be 72 characters or less"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export interface RegisterResult {
  success?: boolean;
  error?: string;
  field?: string;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  try {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { error: first.message, field: first.path[0] as string };
    }

    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return {
        error: "An account with this email already exists.",
        field: "email",
      };
    }

    const passwordHash = await hashPassword(password);

    await db.user.create({
      data: { name, email, passwordHash },
    });

    return { success: true };
  } catch (err) {
    console.error("[registerUser]", err);
    return { error: "Something went wrong. Please try again." };
  }
}
