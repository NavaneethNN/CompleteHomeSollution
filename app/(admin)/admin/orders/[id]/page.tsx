import type { Metadata } from "next";

export const metadata: Metadata = { title: "Order Detail" };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <main>Admin Order: {id}</main>;
}
