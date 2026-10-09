"use server";

import { redirect } from "next/navigation";
import { resetPasswordWithToken } from "@/lib/token";

export async function resetPassword(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!token || password.length < 8 || password.length > 72 || password !== confirm) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=validation`);
  }
  const changed = await resetPasswordWithToken(token, password);
  if (!changed) redirect("/reset-password?error=invalid");
  redirect("/login?reset=success");
}
