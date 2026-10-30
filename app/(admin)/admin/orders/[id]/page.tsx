import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  ArrowLeft,
  Package,
  Truck,
  CreditCard,
  MapPin,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShoppingBag,
  RefreshCw,
  Phone,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { AdminRefundPanel } from "@/components/admin/refund-panel";
import { OrderStatusUpdate } from "@/components/admin/order-status-update";
import { ReadyToShipPanel } from "@/components/admin/ready-to-ship-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Order Details — Admin" };

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline"; color: string }
> = {
  PENDING:          { label: "Pending",          icon: Clock,          variant: "outline",     color: "text-amber-600" },
  PAID:             { label: "Paid",             icon: CheckCircle2,   variant: "secondary",   color: "text-blue-600" },
  CONFIRMED:        { label: "Confirmed",        icon: CheckCircle2,   variant: "secondary",   color: "text-teal-600" },
  PROCESSING:       { label: "Processing",       icon: Package,        variant: "default",     color: "text-indigo-600" },
  SHIPPED:          { label: "Shipped",          icon: Truck,          variant: "default",     color: "text-purple-600" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", icon: Truck,          variant: "default",     color: "text-violet-600" },
  DELIVERED:        { label: "Delivered",        icon: CheckCircle2,   variant: "secondary",   color: "text-emerald-600" },
  CANCELLED:        { label: "Cancelled",        icon: XCircle,        variant: "destructive", color: "text-red-600" },
  REFUNDED:         { label: "Refunded",         icon: AlertCircle,    variant: "outline",     color: "text-slate-600" },
};

async function getOrder(id: string) {
  const order = await db.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      total: true,
      subtotal: true,
      shippingCost: true,
      tax: true,
      discount: true,
      couponCode: true,
      membershipAmount: true,
      guestEmail: true,
      guestPhone: true,
      paywayTransactionId: true,
      trackingNumber: true,
      carrier: true,
      ship123OrderNo: true,
      refundRequested: true,
      refundReason: true,
      refundAmount: true,
      refundedAt: true,
      paywayRefundId: true,
      stripePaymentId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      address: true,
      items: {
        include: {
          product: { select: { id: true, name: true, slug: true, images: true, sku: true } },
          productVariant: {
            include: {
              images: { orderBy: { displayOrder: "asc" } },
              values: {
                include: {
                  variantValue: { include: { variantAttribute: { select: { name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  return order;
}

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  const StatusConfig = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.PAID;
  const StatusIcon = StatusConfig.icon;

  // ── Payment Verification & Integrity Checks ─────────────────────────────
  const hasGatewayTxn = Boolean(order.paywayTransactionId || order.stripePaymentId);
  const isZeroDollarOrder = order.total === 0;
  const isPaymentVerified = isZeroDollarOrder || hasGatewayTxn;

  // Determine gateway provider label and transaction reference
  let paymentMethodLabel = "Awaiting payment";
  let transactionReference: string | null = null;
  if (order.paywayTransactionId?.startsWith("ONLINEPAY:")) {
    paymentMethodLabel = "Westpac OnlinePay (Hosted Payment)";
    transactionReference = order.paywayTransactionId.replace("ONLINEPAY:", "");
  } else if (order.paywayTransactionId) {
    paymentMethodLabel = "Westpac PayWay";
    transactionReference = order.paywayTransactionId;
  } else if (order.stripePaymentId) {
    paymentMethodLabel = "Stripe";
    transactionReference = order.stripePaymentId;
  } else if (isZeroDollarOrder) {
    paymentMethodLabel = "Complimentary ($0.00 Order)";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Order #{order.id.slice(-8).toUpperCase()}</h1>
            <p className="text-sm text-slate-500">
              Placed on {new Date(order.createdAt).toLocaleDateString("en-AU", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isPaymentVerified && order.status !== "CANCELLED" && (
            <Badge variant="destructive" className="bg-red-600 text-white font-bold text-xs px-3 py-1 shadow-xs animate-pulse">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              PAYMENT UNVERIFIED
            </Badge>
          )}
          {isPaymentVerified && hasGatewayTxn && (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold text-xs px-3 py-1">
              <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-600" />
              Gateway Confirmed
            </Badge>
          )}
          <Badge variant={StatusConfig.variant} className="w-fit text-sm px-3 py-1">
            <StatusIcon className="mr-1 h-4 w-4" />
            {StatusConfig.label}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Order Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Order Items ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {order.items.map((item, index) => (
                  <div key={index} className="p-4 flex gap-4">
                    {/* Product Image — prefer variant image over product image */}
                    {(() => {
                      const displayImage =
                        (item as any).productVariant?.images?.[0]?.url ?? item.product.images?.[0];
                      return (
                        <div className="h-20 w-20 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-50">
                          {displayImage ? (
                            <img
                              src={displayImage}
                              alt={item.product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                              <Package className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900 truncate">{item.product.name}</h4>
                      <p className="text-sm text-slate-500">
                        SKU: {(item as any).productVariant?.sku || item.product.sku || "N/A"}
                      </p>

                      {/* Variant attributes */}
                      {(item as any).productVariant?.values?.length > 0 && (
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {(item as any).productVariant.values.map((v: any) => (
                            <span key={v.variantValue.value} className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {v.variantValue.variantAttribute.name}: {v.variantValue.value}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-slate-600">Qty: {item.quantity}</span>
                        <span className="font-medium text-slate-900">
                          {currencyFormatter.format((item as any).unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Order Summary */}
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>{currencyFormatter.format(order.subtotal + (order.discount ?? 0))}</span>
                  </div>
                  {(order.discount ?? 0) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
                      <span>-{currencyFormatter.format(order.discount ?? 0)}</span>
                    </div>
                  )}
                  {(order.membershipAmount ?? 0) > 0 && (
                    <div className="flex justify-between text-indigo-600 font-medium">
                      <span>CHS Membership</span>
                      <span>{currencyFormatter.format(order.membershipAmount ?? 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span>{order.shippingCost > 0 ? currencyFormatter.format(order.shippingCost) : "Free"}</span>
                  </div>
                  {order.tax > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax</span>
                      <span>{currencyFormatter.format(order.tax)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium text-slate-900 text-base">
                    <span>Total</span>
                    <span>{currencyFormatter.format(order.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card className={!isPaymentVerified && order.status !== "CANCELLED" ? "border-red-300 ring-2 ring-red-100" : ""}>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Verification &amp; Details
                </span>
                {isPaymentVerified ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Gateway Verified
                  </span>
                ) : order.status !== "CANCELLED" ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-300 animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    Verification Failed
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Critical Security Alert if order has a balance but no payment transaction exists */}
              {!isPaymentVerified && order.status !== "CANCELLED" && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-xs">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-red-900 text-sm">
                        CRITICAL SECURITY WARNING: No Payment Provider Record
                      </p>
                      <p className="text-xs text-red-800 leading-relaxed">
                        This order has an amount of <strong>{currencyFormatter.format(order.total)}</strong>, but <strong>NO payment transaction reference or signature</strong> was returned from Westpac PayWay, OnlinePay, or Stripe.
                      </p>
                      <p className="text-xs font-bold text-red-950 pt-1">
                        🛑 DO NOT DISPATCH OR FULFILL: Confirm funds in merchant bank account before shipping goods to this customer.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Payment Gateway</p>
                  <p className="font-medium text-slate-900 mt-0.5 flex items-center gap-1.5">
                    {paymentMethodLabel}
                  </p>
                  {transactionReference ? (
                    <p className="text-xs text-slate-600 font-mono mt-1 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">
                      Ref: <strong className="text-slate-900">{transactionReference}</strong>
                    </p>
                  ) : order.total > 0 && order.status !== "CANCELLED" ? (
                    <p className="text-xs text-red-600 font-semibold mt-1">
                      ⚠️ No transaction ID recorded
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-sm text-slate-500">Payment Verification Status</p>
                  <div className="mt-1">
                    {order.status === "REFUNDED" ? (
                      <Badge variant="destructive">Refunded</Badge>
                    ) : order.status === "CANCELLED" ? (
                      <Badge variant="outline">Cancelled / Voided</Badge>
                    ) : order.status === "PENDING" ? (
                      <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50">
                        <Clock className="mr-1 h-3 w-3" />
                        Awaiting Payment
                      </Badge>
                    ) : !isPaymentVerified ? (
                      <Badge variant="destructive" className="bg-red-600 text-white font-bold text-xs py-1">
                        <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                        UNVERIFIED — NO PAYMENT RECORD
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold">
                        <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                        {isZeroDollarOrder ? "Paid ($0.00 Order)" : "Verified & Paid"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Customer & Shipping */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{order.user?.name || order.address?.name || "Guest Customer"}</p>
                  <p className="text-sm text-slate-500">{order.user?.email || order.guestEmail || "No email provided"}</p>
                  {!order.user && (
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      Guest Checkout
                    </span>
                  )}
                </div>
              </div>
              
              {(order.user?.phone || order.guestPhone || order.address?.phone) && (
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="text-slate-900">{order.user?.phone || order.guestPhone || order.address?.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.address ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-slate-900">{order.address.name}</p>
                  <p className="text-slate-600">{order.address.line1}</p>
                  {order.address.line2 && <p className="text-slate-600">{order.address.line2}</p>}
                  <p className="text-slate-600">
                    {order.address.suburb}, {order.address.state} {order.address.postcode}
                  </p>
                  <p className="text-slate-600">{order.address.country}</p>
                  {order.address.phone && (
                    <p className="text-slate-600 mt-2 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {order.address.phone}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No address information available</p>
              )}
            </CardContent>
          </Card>

          {/* Order Status Update */}
          <OrderStatusUpdate
            orderId={order.id}
            currentStatus={order.status}
            currentTrackingNumber={order.trackingNumber}
            currentCarrier={order.carrier}
          />

          {order.items.length > 0 && ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status) && (
            <ReadyToShipPanel
              orderId={order.id}
              currentStatus={order.status}
              currentTrackingNumber={order.trackingNumber}
              currentCarrier={order.carrier}
            />
          )}

          {/* Order Timeline */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Order Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">Order Placed</p>
                    <p className="text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                
                {order.status !== "PENDING" && order.status !== "CANCELLED" && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium text-slate-900">Payment Received</p>
                      <p className="text-slate-500">Order paid successfully</p>
                    </div>
                  </div>
                )}
                
                {order.updatedAt.getTime() !== order.createdAt.getTime() && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium text-slate-900">Last Updated</p>
                      <p className="text-slate-500">
                        {new Date(order.updatedAt).toLocaleDateString("en-AU", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Refund Management */}
          {(["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "REFUNDED"].includes(order.status) || (order.status === "CANCELLED" && order.refundRequested && !!order.paywayTransactionId)) && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refund Management
                  {order.refundRequested && order.status !== "REFUNDED" && (
                    <span className="ml-auto text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      Action Required
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdminRefundPanel
                  orderId={order.id}
                  orderTotal={order.total}
                  refundRequested={order.refundRequested}
                  refundReason={order.refundReason ?? null}
                  alreadyRefunded={order.status === "REFUNDED"}
                  refundAmount={order.refundAmount ?? null}
                  refundedAt={order.refundedAt ?? null}
                  hasPaywayPayment={!!order.paywayTransactionId}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
