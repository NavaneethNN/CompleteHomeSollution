import type { Metadata } from "next";

export const metadata: Metadata = { title: "Order Confirmed" };

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <main>Order Confirmed: {orderId}</main>;
}
