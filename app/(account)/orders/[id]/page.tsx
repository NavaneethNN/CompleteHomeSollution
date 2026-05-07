import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getOrderById } from "@/lib/actions/orders";
import {
  Package,
  ChevronLeft,
  Calendar,
  MapPin,
  CreditCard,
  Truck,
  Box,
  ArrowLeft,
  Printer,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Order Details — Complete Home Sollution" };

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const { order, error } = await getOrderById(id);

  if (error || !order) {
    notFound();
  }

  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = orderDate.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/account/dashboard" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          <Link href="/account/orders" className="hover:text-primary transition-colors">
            My Orders
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          <span className="text-foreground font-medium">Order #{order.id.slice(-8).toUpperCase()}</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Order #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Placed on {formattedDate} at {formattedTime}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={getStatusStyle(order.status)}>{order.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items Card */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <Package className="h-5 w-5" /> Order Items
                </h2>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 p-4 rounded-xl bg-secondary/20"
                    >
                      <div className="w-20 h-20 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden border border-border">
                        {item.product.images?.[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Box className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">
                          Unit Price: ${item.unitPrice.toFixed(2)}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-sm text-muted-foreground">
                            Qty: <span className="font-medium text-foreground">{item.quantity}</span>
                          </p>
                          <p className="font-semibold text-foreground">
                            ${(item.quantity * item.unitPrice).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tracking Info */}
            {(order.trackingNumber || order.status === "SHIPPED" || order.status === "DELIVERED") && (
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    <Truck className="h-5 w-5" /> Shipping Information
                  </h2>
                </div>
                <div className="px-6 py-4">
                  {order.trackingNumber ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Carrier</span>
                        <span className="font-medium text-foreground">{order.carrier || "Standard Delivery"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tracking Number</span>
                        <span className="font-medium text-foreground">{order.trackingNumber}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Tracking information will be available once your order ships.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Order Summary & Address */}
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Order Summary
                </h2>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">${order.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">
                      {order.shippingCost === 0 ? "Free" : `$${order.shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tax (GST)</span>
                    <span className="font-medium">${order.tax.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="text-xl font-bold text-foreground">${order.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <MapPin className="h-5 w-5" /> Delivery Address
                </h2>
              </div>
              <div className="px-6 py-4">
                <address className="not-italic text-sm space-y-1">
                  <p className="font-medium text-foreground">{order.address.line1}</p>
                  {order.address.line2 && (
                    <p className="text-muted-foreground">{order.address.line2}</p>
                  )}
                  <p className="text-muted-foreground">
                    {order.address.suburb}, {order.address.state} {order.address.postcode}
                  </p>
                  <p className="text-muted-foreground">{order.address.country}</p>
                </address>
              </div>
            </div>

            {/* Need Help */}
            <div className="bg-primary/5 rounded-2xl border border-primary/20 p-6">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Need Help?</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    If you have any questions about your order, please contact our support team.
                  </p>
                  <Link
                    href="/contact"
                    className="text-xs font-semibold text-primary hover:underline mt-2 inline-block"
                  >
                    Contact Support
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get status badge styles
function getStatusStyle(status: string): string {
  const baseClasses = "text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide";

  switch (status) {
    case "PENDING":
      return `${baseClasses} bg-amber-100 text-amber-700`;
    case "PAID":
      return `${baseClasses} bg-blue-100 text-blue-700`;
    case "PROCESSING":
      return `${baseClasses} bg-purple-100 text-purple-700`;
    case "SHIPPED":
      return `${baseClasses} bg-indigo-100 text-indigo-700`;
    case "DELIVERED":
      return `${baseClasses} bg-emerald-100 text-emerald-700`;
    case "CANCELLED":
      return `${baseClasses} bg-red-100 text-red-700`;
    case "REFUNDED":
      return `${baseClasses} bg-gray-100 text-gray-700`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-700`;
  }
}
