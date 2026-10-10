import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getAddresses } from "@/lib/actions/address";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { db } from "@/lib/db";
import { getActiveMembershipPlan } from "@/lib/membership-plan";
import { configuredPaymentGateway } from "@/lib/payment-gateway-selection";

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
    <main className="bg-background py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-6 xl:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Secure Checkout</p>
            <h1 className="mt-2 text-3xl font-black text-foreground md:text-4xl">Complete your order</h1>
          </div>
          <Link
            href="/cart"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
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
          isAuthenticated={!!session}
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
