"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createVerificationToken, revokeToken } from "@/lib/token";

export async function resendVerification(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const requestHeaders = await headers();
  const limit = await consumeRateLimit("verification-resend", `${getClientIp(requestHeaders)}:${email}`, 5, 60 * 60);
  if (limit.allowed && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const user = await db.user.findUnique({ where: { email }, select: { name: true, emailVerified: true, passwordHash: true } });
    if (user?.passwordHash && !user.emailVerified) {
      const token = await createVerificationToken(email);
      try {
        await sendVerificationEmail(email, user.name ?? "there", token);
      } catch (error) {
        await revokeToken(token).catch(() => undefined);
        console.error("[verification-resend] email delivery failed", error);
      }
    }
  }
  redirect("/resend-verification?sent=1");
}
