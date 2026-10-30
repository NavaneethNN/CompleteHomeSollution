import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCustomerRaffleDashboard } from "@/lib/actions/raffle";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { CustomerRafflesClient } from "@/components/account/raffles-dashboard-client";
import { ChevronRight, ChevronLeft, Home } from "lucide-react";

export const metadata: Metadata = {
  title: "My Raffles & Wins — Complete Home Sollution",
  description: "View your entered giveaways, ticket codes, and claim your winning gifts.",
};

export default async function CustomerRafflesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account/raffles");
  }

  const { data, error } = await getCustomerRaffleDashboard();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-4 lg:py-12">
        {/* Breadcrumb Navigation */}
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
            <Link
              href="/"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Link
              href="/raffles"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Raffles
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground font-semibold">My Raffles & Wins</span>
          </div>
        </div>

        {/* Account Page Layout */}
        <div className="flex flex-col lg:flex-row gap-6 xl:gap-8 items-start">
          <AccountSidebar user={session.user} />

          <div className="flex-1 min-w-0 w-full">
            {error || !data ? (
              <div className="p-6 rounded-3xl bg-rose-50 text-rose-800 border border-rose-200">
                Failed to load your raffles: {error || "Unknown error"}
              </div>
            ) : (
              <CustomerRafflesClient data={data} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

