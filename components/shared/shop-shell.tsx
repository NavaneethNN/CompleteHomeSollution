"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { PagePreloader } from "@/components/shared/page-preloader";
import { StickyCartBar } from "@/components/shop/sticky-cart-bar";

// Pages where the sticky cart bar would clash with page-level CTAs or be redundant
const HIDE_STICKY_CART_ON = ["/checkout", "/cart"];

export function ShopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const hideStickyCart = HIDE_STICKY_CART_ON.some((p) => pathname.startsWith(p));

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <Suspense fallback={null}>
        <PagePreloader />
      </Suspense>
      <Navbar />
      <div className="flex-1 flex flex-col">{children}</div>
      <Footer />
      {!hideStickyCart && <StickyCartBar />}
    </>
  );
}
