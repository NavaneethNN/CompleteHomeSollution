"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createVerificationToken } from "@/lib/token";
import { sendVerificationEmail } from "@/lib/email";

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

    const { name, password } = parsed.data;
    const email = parsed.data.email.toLowerCase().trim();

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

    const token = await createVerificationToken(email);

    try {
      await sendVerificationEmail(email, name, token);
    } catch (emailErr) {
      const detail = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error("[registerUser] email send failed:", detail);
      await db.user.delete({ where: { email } }).catch(() => null);
      await db.verificationToken.deleteMany({ where: { identifier: email } }).catch(() => null);
      const devMsg = process.env.NODE_ENV === "development" ? ` Debug: ${detail}` : "";
      return {
        error: `Verification email could not be sent. Please try again or contact support.${devMsg}`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("[registerUser]", err);
    return { error: "Something went wrong. Please try again." };
  }
}
