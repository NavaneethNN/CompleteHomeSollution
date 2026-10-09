import type { Metadata } from "next";
import Link from "next/link";
import { resendVerification } from "./actions";

export const metadata: Metadata = { title: "Resend Verification — Complete Home Sollution" };

export default async function ResendVerificationPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return <main className="flex flex-1 items-center justify-center bg-secondary/30 px-5 py-14"><div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
    <h1 className="text-2xl font-black">Resend verification email</h1>
    <p className="mt-3 text-sm text-muted-foreground">Enter your account email. We’ll send a fresh link if the account still needs verification.</p>
    {sent && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">If the account is eligible, a new verification link has been sent.</p>}
    <form action={resendVerification} className="mt-6 space-y-4">
      <label className="block text-sm font-semibold">Email address<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <button className="w-full rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary/90">Send verification link</button>
    </form>
    <Link className="mt-5 inline-block text-sm font-semibold text-primary hover:underline" href="/login">Back to sign in</Link>
  </div></main>;
}
