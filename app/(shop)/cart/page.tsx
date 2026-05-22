import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CartPage as CartPageView } from "@/components/shop/cart-page";

export const metadata: Metadata = { title: "Your Cart" };

export default async function CartPage() {
  const session = await auth();
  let isMember = false;
  if (session?.user?.id) {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isMember: true },
    });
    isMember = dbUser?.isMember ?? false;
  }
  return <CartPageView isMember={isMember} />;
}
