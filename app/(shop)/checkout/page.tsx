import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getAddresses } from "@/lib/actions/address";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { db } from "@/lib/db";
import { getActiveMembershipPlan } from "@/lib/membership-plan";
import { configuredPaymentGateway } from "@/lib/payment-gateway-selection";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const session = await auth();

  // Fetch addresses and user profile for authenticated users
  let addresses: Awaited<ReturnType<typeof getAddresses>>["addresses"] = [];
  let addressError: string | undefined;
  let userProfile: { name: string; phone: string } = { name: "", phone: "" };

  let isMember = false;
  let hasExpiredMembership = false;

  if (session?.user?.id) {
    const [addressResult, dbUser] = await Promise.all([
      getAddresses(),
      db.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, phone: true, isMember: true, membershipExpiry: true },
      }),
    ]);
    addresses = addressResult.addresses || [];
    addressError = addressResult.error;
    userProfile = { name: dbUser?.name ?? "", phone: dbUser?.phone ?? "" };
    isMember = !!dbUser?.isMember && (!dbUser.membershipExpiry || dbUser.membershipExpiry > new Date());
    hasExpiredMembership = !!dbUser?.membershipExpiry && dbUser.membershipExpiry <= new Date();
  }

  const activePlan = await getActiveMembershipPlan();
  const gateway = configuredPaymentGateway(process.env);

  return (
    <main className="bg-background pb-32 pt-4 lg:pb-12 lg:pt-10 w-full max-w-full overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-6 xl:px-8 max-w-full">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 md:mb-8">
          <Link
            href="/cart"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary md:hidden"
            aria-label="Back to cart"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary md:text-xs">Secure Checkout</p>
            <h1 className="text-xl font-black text-foreground md:mt-1 md:text-4xl">Complete your order</h1>
          </div>
          <Link
            href="/cart"
            className="hidden items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary md:inline-flex"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Cart
          </Link>
        </div>

        {/* Checkout Form */}
        <CheckoutForm
          usesOnlinePay={gateway === "onlinepay"}
          paymentAvailable={gateway !== null}
          savedAddresses={addresses || []}
          addressesError={addressError}
          isAuthenticated={!!session?.user?.id}
          userId={session?.user?.id}
          userProfile={userProfile}
          isMember={isMember}
          hasExpiredMembership={hasExpiredMembership}
          activePlan={activePlan ?? undefined}
        />
      </div>
    </main>
  );
}
