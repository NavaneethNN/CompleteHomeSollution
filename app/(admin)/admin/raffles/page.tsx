import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAdminRaffles } from "@/lib/actions/admin-raffle";
import { RafflesListClient } from "@/components/admin/raffles-list-client";

export const metadata: Metadata = {
  title: "Raffle Management — Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminRafflesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { raffles, error } = await getAdminRaffles();

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 md:py-8 max-w-7xl">
      <RafflesListClient initialRaffles={raffles} />
    </div>
  );
}
