import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { RaffleFormClient } from "@/components/admin/raffle-form-client";

export const metadata: Metadata = {
  title: "Create Raffle Campaign — Admin",
};

export const dynamic = "force-dynamic";

export default async function NewRafflePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const products = await db.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      basePrice: true,
      images: true,
    },
    orderBy: { name: "asc" },
  });

  return <RaffleFormClient availableProducts={products} />;
}

