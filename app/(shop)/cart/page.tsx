import type { Metadata } from "next";
import { auth } from "@/auth";
import { CartPage as CartPageView } from "@/components/shop/cart-page";

export const metadata: Metadata = { title: "Your Cart" };

export default async function CartPage() {
  const session = await auth();
  const isMember = Boolean(session?.user?.isMember);
  return <CartPageView isMember={isMember} />;
}

