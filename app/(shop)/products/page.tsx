import type { Metadata } from "next";

export const metadata: Metadata = { title: "All Products" };

export const revalidate = 3600;

export default function ProductsPage() {
  return <main>Products</main>;
}
