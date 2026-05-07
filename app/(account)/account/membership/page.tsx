import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Crown, ChevronRight, Star, Truck, ShieldCheck, Tag, ChevronLeft, Home } from "lucide-react";
import { AccountSidebar } from "@/components/account/account-sidebar";

export const metadata: Metadata = { title: "Membership — Complete Home Sollution" };

const PERKS = [
  { Icon: Tag,         text: "Up to 30% off every order" },
  { Icon: Truck,       text: "Free express delivery on orders over $200" },
  { Icon: ShieldCheck, text: "Extended 3-year warranty on all products" },
  { Icon: Star,        text: "Priority customer support 7 days a week" },
] as const;

export default async function MembershipPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

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
            <span className="text-foreground font-medium">Membership</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <AccountSidebar user={session.user} />

          {/* Main Content */}
          <main className="flex-1 min-w-0">

            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div
                className="px-6 py-10 text-white text-center"
                style={{ backgroundColor: "var(--navy)" }}
              >
                <Crown className="h-10 w-10 text-amber-400 mx-auto mb-3" />
                <h1 className="text-2xl font-black mb-2">Complete Home Sollution Membership</h1>
                <p className="text-white/60 text-sm max-w-md mx-auto">
                  Join our exclusive membership program and save big on every order.
                </p>
              </div>
              <div className="p-8">
                <h2 className="font-bold text-foreground text-center mb-6">Member Benefits</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {PERKS.map(({ Icon, text }) => (
                    <div key={text} className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 border border-border">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">Membership plans coming soon. Contact us to learn more.</p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
                  >
                    Back to Shop
                  </Link>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
