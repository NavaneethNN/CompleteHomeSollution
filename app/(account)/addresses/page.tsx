import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAddresses } from "@/lib/actions/address";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { AddressManager } from "@/components/account/address-manager";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "My Addresses — Complete Home Sollution" };

export default async function AddressesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [{ addresses, error }, dbUser] = await Promise.all([
    getAddresses(),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, phone: true },
    }),
  ]);

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          <AccountSidebar user={session.user} />
          <AddressManager
            addresses={addresses || []}
            error={error}
            userProfile={{ name: dbUser?.name ?? "", phone: dbUser?.phone ?? "" }}
          />
        </div>
      </div>
    </div>
  );
}
