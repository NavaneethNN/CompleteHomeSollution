import type { Metadata } from "next";
import { CartPage as CartPageView } from "@/components/shop/cart-page";

export const metadata: Metadata = { title: "Your Cart" };

export default function CartPage() {
  return <CartPageView />;
}
