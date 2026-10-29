import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllPromotions } from "@/lib/actions/promotions";
import { PromotionsClient } from "@/components/admin/promotions-client";

export const metadata: Metadata = {
  title: "Posters & Promotional Banners — Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const promotions = await getAllPromotions();

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 md:py-8 max-w-7xl">
      <PromotionsClient initialPromotions={promotions} />
    </div>
  );
}
