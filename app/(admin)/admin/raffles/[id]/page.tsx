import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getAdminRaffleById } from "@/lib/actions/admin-raffle";
import { RaffleDrawConsole } from "@/components/admin/raffle-draw-console";

export const metadata: Metadata = {
  title: "Raffle Draw Console & Fulfilment — Admin",
};

export const dynamic = "force-dynamic";

interface ConsolePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminRaffleDetailPage({ params }: ConsolePageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const { raffle, error } = await getAdminRaffleById(id);

  if (!raffle || error) {
    notFound();
  }

  return <RaffleDrawConsole raffle={raffle} />;
}

