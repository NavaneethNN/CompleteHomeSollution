import { OrderMembershipItem } from "@/components/account/order-membership-item";
import { orderContentsLabel, getEffectiveOrderStatus } from "@/lib/order-display";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getOrderById } from "@/lib/actions/orders";
import { getTrackingUrl } from "@/lib/tracking-url";
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
  Check,
  Clock,
  Hash,
  Store,
  Navigation,
  FileText,
  AlertCircle,
} from "lucide-react";
import { STORE_PICKUP_LOCATION } from "@/lib/store-info";
import { CancelOrderButton } from "@/components/shop/cancel-order-button";
import { BuyAgainButton } from "@/components/shop/buy-again-button";
import { RefreshOrderStatus } from "@/components/account/refresh-order-status";

export const metadata: Metadata = { title: "Order Details — Complete Home Sollution" };
export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { order, error } = await getOrderById(id);
  if (error || !order) notFound();

  const membershipOnly = order.membershipAmount > 0 && order.items.length === 0;
  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString("en-AU", {
    day: "numeric", month: "long", year: "numeric",
  });
  const formattedTime = orderDate.toLocaleTimeString("en-AU", {
    hour: "2-digit", minute: "2-digit",
  });

  const isPaid = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);
  const trackingUrl = order.trackingNumber ? getTrackingUrl(order.carrier, order.trackingNumber) : null;
  const isPreShip = ["PAID", "CONFIRMED", "PROCESSING"].includes(order.status);
  const isPostShip = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);
  const isCancellable = isPreShip || isPostShip;
  const effectiveStatus = getEffectiveOrderStatus(order);
  const isStorePickup = order.fulfillmentType === "STORE_PICKUP";

  // Stepper calculations for store pickup
  const pickupStep1Done = isPaid;
  const pickupStep2Done = Boolean(effectiveStatus.isAppointmentScheduled || effectiveStatus.isReadyForPickup || effectiveStatus.isPickedUp);
  const pickupStep3Done = Boolean(effectiveStatus.isReadyForPickup || effectiveStatus.isPickedUp);
  const pickupStep4Done = effectiveStatus.isPickedUp;

  return (
    <div className="min-h-screen bg-secondary/30">
      <RefreshOrderStatus orderId={order.id} status={order.status} updatedAt={order.updatedAt.toISOString()} />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/account/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/account/orders" className="hover:text-primary transition-colors">My Orders</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{order.membershipAmount > 0 && order.items.length === 0 ? "Membership" : "Order"} #{order.id.slice(-8).toUpperCase()}</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {order.membershipAmount > 0 && order.items.length === 0 ? "Membership" : "Order"} #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Placed on {formattedDate} at {formattedTime}
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {order.status !== "PENDING" && <BuyAgainButton items={order.items} variant="outline" size="sm" />}
            {isStorePickup && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full uppercase tracking-wide">
                <Store className="h-3.5 w-3.5 text-slate-600" />
                Store Pickup
              </span>
            )}
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide border ${effectiveStatus.badgeStyle}`}>
              {effectiveStatus.label}
            </span>
          </div>
        </div>

        {/* ── Pending Payment Banner ── */}
        {order.status === "PENDING" && (
          <div className="mb-6 rounded-2xl border border-border bg-secondary/40 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground text-sm">Payment not completed</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  This order is waiting for payment. Your items are reserved but will not be confirmed until payment is completed.
                </p>
              </div>
            </div>
            <Link
              href={`/order-confirmation/${order.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold px-5 py-2.5 transition-colors shrink-0"
            >
              <CreditCard className="h-4 w-4" />
              Complete Payment
            </Link>
          </div>
        )}

        {/* ── Enhanced Store Pickup Experience ── */}
        {isStorePickup && (
          <div className="mb-8 rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs">
            {/* Pickup Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-secondary text-foreground border border-border flex items-center justify-center shrink-0">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">Store Pickup Details</h3>
                  <p className="text-xs text-muted-foreground">
                    Collect directly from Complete Home Sollution Showroom &amp; Warehouse
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {effectiveStatus.isPickedUp ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Order Collected &amp; Completed
                  </span>
                ) : effectiveStatus.isReadyForPickup ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready for Collection
                  </span>
                ) : effectiveStatus.isAppointmentScheduled ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-foreground border border-border">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Appointment Confirmed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground border border-border">
                    <Clock className="h-3.5 w-3.5" /> Coordinating Appointment
                  </span>
                )}
              </div>
            </div>

            {/* Store Pickup 4-Stage Visual Stepper */}
            {order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
              <div className="py-5 border-b border-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Step 1: Placed */}
                  <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${pickupStep1Done ? "bg-secondary/40 border-border text-foreground" : "bg-card border-border/60 text-muted-foreground"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${pickupStep1Done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">1. Order Placed</p>
                      <p className="text-[10px] text-muted-foreground">Payment Confirmed</p>
                    </div>
                  </div>

                  {/* Step 2: Appointment Scheduled */}
                  <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${pickupStep2Done ? "bg-secondary/40 border-border text-foreground" : "bg-card border-border/60 text-muted-foreground"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${pickupStep2Done ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                      {pickupStep2Done ? <Check className="h-3.5 w-3.5" /> : "2"}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">2. Appointment</p>
                      <p className="text-[10px] text-muted-foreground">{pickupStep2Done ? "Date & Time Set" : "Pending Contact"}</p>
                    </div>
                  </div>

                  {/* Step 3: Ready for Pickup */}
                  <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${pickupStep3Done ? "bg-secondary/40 border-border text-foreground" : "bg-card border-border/60 text-muted-foreground"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${pickupStep3Done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
                      {pickupStep3Done ? <Check className="h-3.5 w-3.5" /> : "3"}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">3. Ready in Store</p>
                      <p className="text-[10px] text-muted-foreground">{pickupStep3Done ? "Items Packed" : "Preparing Order"}</p>
                    </div>
                  </div>

                  {/* Step 4: Picked Up */}
                  <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${pickupStep4Done ? "bg-secondary/40 border-border text-foreground" : "bg-card border-border/60 text-muted-foreground"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${pickupStep4Done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
                      {pickupStep4Done ? <Check className="h-3.5 w-3.5" /> : "4"}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">4. Collected</p>
                      <p className="text-[10px] text-muted-foreground">{pickupStep4Done ? "Pickup Complete" : "Awaiting Pickup"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Detail Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-sm">
              {/* Showroom & Directions */}
              <div className="bg-secondary/30 p-4 rounded-xl border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5 text-muted-foreground" />
                    Collection Showroom
                  </p>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Open for Pickup
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-foreground text-base">{STORE_PICKUP_LOCATION.name}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{STORE_PICKUP_LOCATION.fullAddress}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    <strong>Hours:</strong> {STORE_PICKUP_LOCATION.hours}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    <strong>Phone:</strong> {STORE_PICKUP_LOCATION.contactPhone}
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Complete+Home+Sollution+18+Edison+Drive+Golden+Grove+SA+5125"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Get Directions
                  </a>
                  <a
                    href={`tel:${STORE_PICKUP_LOCATION.contactPhone}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground bg-white hover:bg-secondary px-3 py-1.5 rounded-lg border border-border transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call Showroom
                  </a>
                </div>
              </div>

              {/* Scheduled Appointment Details */}
              <div className="bg-secondary/30 p-4 rounded-xl border border-border space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-foreground text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Scheduled Appointment
                    </p>
                    {order.pickupAppointmentDate && (
                      <span className="text-[11px] font-semibold text-foreground bg-white px-2 py-0.5 rounded border border-border">
                        Slot Confirmed
                      </span>
                    )}
                  </div>

                  {order.pickupAppointmentDate ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-white rounded-lg border border-border">
                        <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-primary shrink-0" />
                          {new Date(order.pickupAppointmentDate).toLocaleDateString("en-AU", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        {order.pickupAppointmentTime && (
                          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mt-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {order.pickupAppointmentTime}
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Your goods are held specifically for this collection window. If you need to reschedule, please call our team at least 2 hours in advance.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded-lg border border-border text-xs text-muted-foreground leading-relaxed space-y-1">
                      <p className="font-semibold text-foreground">Coordinating Appointment Slot</p>
                      <p>
                        Our showroom team will contact you shortly by phone or email to schedule a convenient collection slot.
                      </p>
                    </div>
                  )}
                </div>

                {/* What to Bring Checklist */}
                <div className="pt-2 border-t border-border">
                  <p className="text-[11px] font-bold text-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <FileText className="h-3 w-3 text-muted-foreground" /> What to bring for collection:
                  </p>
                  <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                    <li>Order Number: <strong className="font-mono text-foreground">#{order.id.slice(-8).toUpperCase()}</strong></li>
                    <li>Matching Photo ID (Driver&apos;s License or Passport)</li>
                    <li>Suitable vehicle or trailer for bulky item collection</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Admin Notes if provided */}
            {order.pickupNotes && (
              <div className="mt-4 p-3 bg-secondary/40 rounded-xl border border-border text-xs text-foreground">
                <p className="font-bold text-foreground flex items-center gap-1.5 mb-0.5">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  Special Instructions from Showroom Staff:
                </p>
                <p className="text-muted-foreground">{order.pickupNotes}</p>
              </div>
            )}
          </div>
        )}

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
                    ({orderContentsLabel(order)})
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-border">
                {order.membershipAmount > 0 && <div className="px-5"><OrderMembershipItem amount={order.membershipAmount} durationDays={order.membershipDurationDays} /></div>}
                {order.items.map((item) => {
                  const variantDetails =
                    item.productVariant?.values
                      ?.map((v) => `${v.variantValue.variantAttribute.name}: ${v.variantValue.value}`)
                      .join(" · ") || item.variantSummary || null;

                  return (
                    <div key={item.id} className="flex items-start gap-4 p-5">
                      {(() => {
                        const displayImage =
                          item.productVariant?.images?.[0]?.url ?? item.product.images?.[0];
                        return (
                          <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border">
                            {displayImage ? (
                              <img
                                src={displayImage}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Box className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 text-sm"
                        >
                          {item.product.name}
                        </Link>

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

            {/* Shipping / Pickup Information */}
            {!membershipOnly && (
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    {order.fulfillmentType === "STORE_PICKUP" ? (
                      <>
                        <Store className="h-5 w-5 text-primary" /> Pickup Information
                      </>
                    ) : (
                      <>
                        <Truck className="h-5 w-5 text-primary" /> Shipping Information
                      </>
                    )}
                  </h2>
                </div>
                <div className="px-6 py-4 space-y-3">
                  {order.fulfillmentType === "STORE_PICKUP" ? (
                    <div className="space-y-2 text-sm">
                      <Row label="Method" value="Store Pickup (Golden Grove SA Showroom)" />
                      <Row label="Address" value={STORE_PICKUP_LOCATION.fullAddress} />
                      <Row
                        label="Status"
                        value={
                          order.pickupStatus === "PICKED_UP"
                            ? "Collected"
                            : order.pickupStatus === "READY_FOR_PICKUP"
                            ? "Ready for Collection"
                            : order.pickupStatus === "SCHEDULED"
                            ? "Appointment Scheduled"
                            : "Coordinating Appointment"
                        }
                      />
                    </div>
                  ) : order.fulfillmentType === "MANUAL_DELIVERY" ? (
                    <div className="space-y-2 text-sm">
                      <Row label="Method" value="Store Scheduled Delivery (Large / Bulky Goods)" />
                      <Row label="Status" value="Dispatched directly by store admin" />
                      <p className="text-xs text-muted-foreground pt-1">
                        Our logistics team will contact you to coordinate a scheduled delivery slot.
                      </p>
                    </div>
                  ) : order.trackingNumber ? (
                    <>
                      <Row label="Carrier" value={order.carrier || "Standard Delivery"} />
                      <Row label="Tracking Number" value={order.trackingNumber} mono />
                      {trackingUrl && (
                        <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-semibold text-primary hover:underline">
                          Track with {order.carrier}
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Tracking information will be available once your order ships.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column ── */}
          <div className="space-y-6">

            {/* Payment & Summary */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" /> Payment & Summary
                </h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                {!membershipOnly && <Row label="Subtotal" value={`$${order.subtotal.toFixed(2)}`} />}
                {order.membershipAmount > 0 && <Row label="Membership" value={`$${order.membershipAmount.toFixed(2)}`} />}
                <Row
                  label={membershipOnly ? "Delivery" : order.fulfillmentType === "STORE_PICKUP" ? "Store Pickup" : "Shipping"}
                  value={
                    membershipOnly
                      ? "Not required"
                      : order.fulfillmentType === "STORE_PICKUP"
                      ? "Free (Store Pickup)"
                      : order.shippingCost === 0
                      ? "Free"
                      : `$${order.shippingCost.toFixed(2)}`
                  }
                  valueClass={order.fulfillmentType === "STORE_PICKUP" || order.shippingCost === 0 ? "text-emerald-600 font-semibold" : undefined}
                />
                {order.tax > 0 ? (
                  <Row label="GST (10%)" value={`$${order.tax.toFixed(2)}`} />
                ) : (
                  <Row label="GST" value="Included in price" valueClass="text-emerald-600 font-medium" />
                )}
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">${order.total.toFixed(2)}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-border space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className={`flex items-center gap-1.5 font-semibold text-xs px-2.5 py-1 rounded-full ${isPaid ? "bg-emerald-100 text-emerald-700" : order.status === "REFUNDED" ? "bg-gray-100 text-gray-700" : order.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {isPaid
                        ? <><CheckCircle2 className="h-3.5 w-3.5" /> Paid</>
                        : order.status === "REFUNDED"
                          ? "Refunded"
                          : order.status === "CANCELLED"
                            ? order.refundRequested ? "Refund pending" : "Cancelled"
                            : <><Clock className="h-3.5 w-3.5" /> Pending</>
                      }
                    </span>
                  </div>
                  {order.paywayTransactionId && (
                    <div className="flex items-start justify-between text-sm gap-3">
                      <span className="text-muted-foreground shrink-0">Payment ID</span>
                      <span className="font-mono text-xs text-foreground break-all text-right">
                        {order.paywayTransactionId}
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
                  <MapPin className="h-5 w-5 text-primary" /> {membershipOnly || order.fulfillmentType === "STORE_PICKUP" ? "Billing Address" : "Delivery Address"}
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

            {/* Cancel / Refund */}
            {isCancellable && (
              <CancelOrderButton
                orderId={order.id}
                orderTotal={order.total}
                isPreShip={isPreShip}
                alreadyRequested={order.refundRequested}
              />
            )}

            {/* Refund info if already refunded */}
            {order.status === "REFUNDED" && order.refundAmount != null && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 text-sm space-y-1">
                <p className="font-semibold text-gray-700">Refund Processed</p>
                <p className="text-muted-foreground">Amount: <span className="font-medium text-foreground">A${order.refundAmount.toFixed(2)}</span></p>
                {order.refundedAt && (
                  <p className="text-muted-foreground">Date: {new Date(order.refundedAt).toLocaleDateString("en-AU")}</p>
                )}
              </div>
            )}

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
      <span className={mono ? "font-mono text-xs text-foreground" : `font-medium text-foreground ${valueClass ?? ""}`}>
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
    case "CONFIRMED":  return `${base} bg-blue-100 text-blue-700`;
    case "PROCESSING": return `${base} bg-purple-100 text-purple-700`;
    case "SHIPPED":    return `${base} bg-indigo-100 text-indigo-700`;
    case "OUT_FOR_DELIVERY": return `${base} bg-indigo-100 text-indigo-700`;
    case "DELIVERED":  return `${base} bg-emerald-100 text-emerald-700`;
    case "CANCELLED":  return `${base} bg-red-100 text-red-700`;
    case "REFUNDED":   return `${base} bg-gray-100 text-gray-700`;
    default:           return `${base} bg-gray-100 text-gray-700`;
  }
}

function formatStatusLabel(status: string): string {
  return status.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
