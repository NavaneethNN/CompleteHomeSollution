import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminRaffleById } from "@/lib/actions/admin-raffle";
import { RaffleFormClient } from "@/components/admin/raffle-form-client";

export const metadata: Metadata = {
  title: "Edit Raffle Campaign — Admin",
};

export const dynamic = "force-dynamic";

interface EditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditRafflePage({ params }: EditPageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const [{ raffle }, products] = await Promise.all([
    getAdminRaffleById(id),
    db.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        basePrice: true,
        images: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!raffle) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 md:py-8 max-w-5xl">
      <RaffleFormClient initialData={raffle} availableProducts={products} />
    </div>
  );
}

