import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getOrderById } from "@/lib/actions/orders";
import {
  Package,
  ChevronRight,
  Calendar,
  MapPin,
  CreditCard,
  Truck,
  Box,
  HelpCircle,
  Phone,
  User,
  Tag,
  CheckCircle2,
  Clock,
  Hash,
} from "lucide-react";

export const metadata: Metadata = { title: "Order Details — Complete Home Sollution" };

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { order, error } = await getOrderById(id);
  if (error || !order) notFound();

  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString("en-AU", {
    day: "numeric", month: "long", year: "numeric",
  });
  const formattedTime = orderDate.toLocaleTimeString("en-AU", {
    hour: "2-digit", minute: "2-digit",
  });

  const isPaid = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status);

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/account/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/account/orders" className="hover:text-primary transition-colors">My Orders</Link>
          <ChevronRight className="h-3.5 w-3.5" />
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
          <span className={getStatusStyle(order.status)}>{order.status}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left Column ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Order Items */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Order Items
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({order.items.length} {order.items.length === 1 ? "item" : "items"})
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-border">
                {order.items.map((item) => {
                  // Build variant string from productVariant.values or fall back to variantSummary
                  const variantDetails =
                    item.productVariant?.values
                      ?.map((v) => `${v.variantValue.variantAttribute.name}: ${v.variantValue.value}`)
                      .join(" · ") || item.variantSummary || null;

                  return (
                    <div key={item.id} className="flex items-start gap-4 p-5">
                      {/* Product image */}
                      <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border">
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

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 text-sm"
                        >
                          {item.product.name}
                        </Link>

                        {/* Variant badges */}
                        {variantDetails && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {variantDetails.split(" · ").map((v, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-[11px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full border border-border"
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {v}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* SKU */}
                        {item.productVariant?.sku && (
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            SKU: {item.productVariant.sku}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-3">
                          <p className="text-xs text-muted-foreground">
                            Qty: <span className="font-semibold text-foreground">{item.quantity}</span>
                            <span className="mx-1.5 text-border">·</span>
                            <span className="text-muted-foreground">${item.unitPrice.toFixed(2)} each</span>
                          </p>
                          <p className="font-bold text-foreground text-sm">
                            ${(item.quantity * item.unitPrice).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shipping / Tracking */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" /> Shipping Information
                </h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                {order.trackingNumber ? (
                  <>
                    <Row label="Carrier" value={order.carrier || "Standard Delivery"} />
                    <Row label="Tracking Number" value={order.trackingNumber} mono />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Tracking information will be available once your order ships.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Right Column ── */}
          <div className="space-y-6">

            {/* Payment Summary */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" /> Payment & Summary
                </h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                <Row label="Subtotal" value={`$${order.subtotal.toFixed(2)}`} />
                <Row
                  label="Shipping"
                  value={order.shippingCost === 0 ? "Free" : `$${order.shippingCost.toFixed(2)}`}
                  valueClass={order.shippingCost === 0 ? "text-emerald-600 font-semibold" : undefined}
                />
                <Row label="GST (10%)" value={`$${order.tax.toFixed(2)}`} />
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">${order.total.toFixed(2)}</span>
                </div>

                {/* Payment status */}
                <div className="mt-4 pt-4 border-t border-border space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className={`flex items-center gap-1.5 font-semibold text-xs px-2.5 py-1 rounded-full ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {isPaid
                        ? <><CheckCircle2 className="h-3.5 w-3.5" /> Paid</>
                        : <><Clock className="h-3.5 w-3.5" /> Pending</>
                      }
                    </span>
                  </div>
                  {order.stripePaymentId && (
                    <div className="flex items-start justify-between text-sm gap-3">
                      <span className="text-muted-foreground shrink-0">Payment ID</span>
                      <span className="font-mono text-xs text-foreground break-all text-right">
                        {order.stripePaymentId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" /> Delivery Address
                </h2>
              </div>
              <div className="px-6 py-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-foreground">{order.address.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{order.address.phone}</span>
                </div>
                <div className="flex items-start gap-2 text-sm pt-1">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <address className="not-italic text-muted-foreground space-y-0.5">
                    <p>{order.address.line1}</p>
                    {order.address.line2 && <p>{order.address.line2}</p>}
                    <p>{order.address.suburb}, {order.address.state} {order.address.postcode}</p>
                    <p>{order.address.country}</p>
                  </address>
                </div>
              </div>
            </div>

            {/* Need Help */}
            <div className="bg-primary/5 rounded-2xl border border-primary/20 p-5">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Need Help?</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Have a question about this order? Our team is happy to help.
                  </p>
                  <Link
                    href="/contact"
                    className="text-xs font-semibold text-primary hover:underline mt-2 inline-block"
                  >
                    Contact Support →
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

function Row({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? `font-mono text-xs text-foreground` : `font-medium text-foreground ${valueClass ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

function getStatusStyle(status: string): string {
  const base = "text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide";
  switch (status) {
    case "PENDING":    return `${base} bg-amber-100 text-amber-700`;
    case "PAID":       return `${base} bg-blue-100 text-blue-700`;
    case "PROCESSING": return `${base} bg-purple-100 text-purple-700`;
    case "SHIPPED":    return `${base} bg-indigo-100 text-indigo-700`;
    case "DELIVERED":  return `${base} bg-emerald-100 text-emerald-700`;
    case "CANCELLED":  return `${base} bg-red-100 text-red-700`;
    case "REFUNDED":   return `${base} bg-gray-100 text-gray-700`;
    default:           return `${base} bg-gray-100 text-gray-700`;
  }
}
