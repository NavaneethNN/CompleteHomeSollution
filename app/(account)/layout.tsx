import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return <div className="min-h-screen">{children}</div>;
}
