import type { Metadata } from "next";
import Link from "next/link";
import { resetPassword } from "./actions";

export const metadata: Metadata = { title: "Reset Password — Complete Home Sollution" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  const invalid = error === "invalid" || !token;
  return <main className="flex flex-1 items-center justify-center bg-secondary/30 px-5 py-14"><div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
    <h1 className="text-2xl font-black">Choose a new password</h1>
    {invalid ? <><p className="mt-3 text-sm text-red-700">This reset link is invalid, expired, or already used.</p><Link className="mt-6 inline-block font-bold text-primary hover:underline" href="/forgot-password">Request another link</Link></> : <form action={resetPassword} className="mt-6 space-y-4">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Passwords must match and contain 8–72 characters.</p>}
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm font-semibold">New password<input name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password" className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <label className="block text-sm font-semibold">Confirm password<input name="confirmPassword" type="password" minLength={8} maxLength={72} required autoComplete="new-password" className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <button className="w-full rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary/90">Update password</button>
    </form>}
  </div></main>;
}
