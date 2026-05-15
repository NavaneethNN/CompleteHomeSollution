import type { Metadata } from "next";
import { WishlistPage } from "@/components/shop/wishlist-page";

export const metadata: Metadata = {
  title: "Wishlist — Complete Home Sollution",
  description: "Save your favorite furniture pieces and move them to cart when you're ready.",
};

export default function WishlistRoutePage() {
  return <WishlistPage />;
}
