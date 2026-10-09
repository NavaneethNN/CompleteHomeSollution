"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createPasswordResetToken, revokeToken } from "@/lib/token";

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const requestHeaders = await headers();
  const limit = await consumeRateLimit("password-reset", `${getClientIp(requestHeaders)}:${email}`, 5, 60 * 60);
  if (limit.allowed && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const user = await db.user.findUnique({ where: { email }, select: { name: true, passwordHash: true } });
    if (user?.passwordHash) {
      const token = await createPasswordResetToken(email);
      try {
        await sendPasswordResetEmail(email, user.name ?? "there", token);
      } catch (error) {
        await revokeToken(token).catch(() => undefined);
        console.error("[password-reset] email delivery failed", error);
      }
    }
  }
  redirect("/forgot-password?sent=1");
}
