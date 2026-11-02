import { Metadata } from "next";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ManualDeliveryClient } from "@/components/admin/manual-delivery-client";

export const metadata: Metadata = {
  title: "Manual Delivery Postcodes | Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    redirect("/admin/login");
  }

  const postcodes = await db.manualDeliveryPostcode.findMany({
    orderBy: { postcode: "asc" },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ManualDeliveryClient initialPostcodes={postcodes} />
    </div>
  );
}

