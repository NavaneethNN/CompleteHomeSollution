import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAddresses } from "@/lib/actions/address";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { AddressManager } from "@/components/account/address-manager";
import { ChevronLeft, Home, ChevronRight } from "lucide-react";

export const metadata: Metadata = { title: "My Addresses — Complete Home Sollution" };

export default async function AddressesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { addresses, error } = await getAddresses();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-4 lg:py-12">
        {/* Breadcrumb / Back Navigation */}
        <div className="flex items-center gap-2 mb-4 lg:mb-6">
          <Link 
            href="/account/dashboard" 
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <span className="text-muted-foreground">·</span>
          <div className="flex items-center gap-1.5 text-sm">
            <Home className="h-3.5 w-3.5 text-muted-foreground" />
            <Link href="/account/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium">Addresses</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <AccountSidebar user={session.user} />
          <AddressManager addresses={addresses || []} error={error} />
        </div>
      </div>
    </div>
  );
}
