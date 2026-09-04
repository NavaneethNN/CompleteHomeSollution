import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Package, ArrowRight, Mail, Crown } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ClearCartOnSuccess } from "@/components/shop/clear-cart-on-success";

export const metadata: Metadata = { title: "Order Confirmed — Complete Home Sollution" };

async function getOrderIfAuthorized(
  orderId: string,
  userId: string | undefined,
  userRole: string | undefined
) {
  if (!/^c[a-z0-9]{24,}$/.test(orderId)) return { order: null, authorized: false };

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { select: { name: true, slug: true, images: true } },
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
      address: true,
      user: { select: { email: true, name: true } },
    },
  }).catch(() => null);

  if (!order) return { order: null, authorized: false };

  // Auth check: authenticated owner or admin
  if (userId && (order.userId === userId || userRole === "ADMIN")) {
    return { order, authorized: true };
  }

  // Guest order — allow if order has no userId (guest checkout)
  if (!order.userId) {
    return { order, authorized: true };
  }

  return { order: null, authorized: false };
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  if (!orderId) return notFound();

  const authSession = await auth();
  const userId = authSession?.user?.id;
  const userRole = authSession?.user?.role;

  const { order, authorized } = await getOrderIfAuthorized(orderId, userId, userRole);

  // If not authorized to view order details, show limited confirmation
  if (!authorized || !order) {
    return (
      <main className="bg-background py-12 md:py-16">
        <div className="container mx-auto max-w-2xl px-4 md:px-6">
          <div className="text-center mb-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-5">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-black text-foreground md:text-4xl">Order Confirmed!</h1>
            <p className="mt-3 text-muted-foreground">
              Thank you for your purchase. Your order has been placed successfully.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 text-center space-y-4">
            <p className="text-sm font-mono font-semibold">#{orderId.slice(-8).toUpperCase()}</p>
            <p className="text-sm text-muted-foreground">
              You&apos;ll receive a confirmation email shortly. Sign in to view full order details.
            </p>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Continue Shopping <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              Sign In to View Order
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Check if membership was included in this order
  const membershipActivated =
    order.status === "PAID" &&
    (order as Record<string, unknown>).addMembership === true;

  return (
    <main className="bg-background py-12 md:py-16">
      {/* Clear cart now that payment succeeded */}
      <ClearCartOnSuccess />

      <div className="container mx-auto max-w-2xl px-4 md:px-6">
        {/* Success Header */}
        <div className="text-center mb-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-5">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-black text-foreground md:text-4xl">Order Confirmed!</h1>
          <p className="mt-3 text-muted-foreground">
            Thank you for your purchase. Your order has been placed successfully.
          </p>
        </div>

        {/* Order Details Card */}
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
          {/* Order ID */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Order Number</p>
              <p className="mt-1 text-sm font-mono font-semibold text-foreground">
                #{orderId.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Items Ordered</h3>
            <div className="divide-y divide-border">
              {order.items.map((item) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const variantLabel = (item as any).productVariant?.values
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ?.map((v: any) => v.variantValue.value)
                  .join(" / ");
                return (
                  <div key={item.id} className="flex justify-between py-2.5 text-sm">
                    <span className="text-muted-foreground">
                      {item.product.name}
                      {variantLabel && (
                        <span className="text-xs ml-1 text-muted-foreground/70">
                          ({variantLabel})
                        </span>
                      )}{" "}
                      <span className="text-xs">&times; {item.quantity}</span>
                    </span>
                    <span className="font-medium">
                      {currencyFormatter.format(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                {currencyFormatter.format(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (order as any).subtotal + ((order as any).discount ?? 0)
                )}
              </span>
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {((order as any).discount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  Discount {(order as any).couponCode && `(${(order as any).couponCode})`}
                </span>
                <span className="font-medium text-green-600">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  -{currencyFormatter.format((order as any).discount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>
                {order.shippingCost === 0 ? (
                  <span className="text-green-600">Free</span>
                ) : (
                  currencyFormatter.format(order.shippingCost)
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST (10%)</span>
              <span>{currencyFormatter.format(order.tax)}</span>
            </div>
            {membershipActivated && (
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium flex items-center gap-1">
                  <Crown className="h-3.5 w-3.5" /> CHS Premium Membership
                </span>
                <span className="font-medium text-primary">+{currencyFormatter.format(30)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span>{currencyFormatter.format(order.total)}</span>
            </div>
          </div>

          {/* Shipping Address */}
          {order.address && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Shipping To</h3>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">{order.address.name}</p>
                <p>
                  {order.address.line1}
                  {order.address.line2 ? `, ${order.address.line2}` : ""}
                </p>
                <p>
                  {order.address.suburb}, {order.address.state} {order.address.postcode}
                </p>
              </div>
            </div>
          )}

          {/* Email Notification */}
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-100 p-4">
            <Mail className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Confirmation email sent</p>
              <p className="text-xs text-blue-700 mt-0.5">
                We&apos;ve sent order details to{" "}
                {order.user?.email || order.guestEmail || "your email"}.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Continue Shopping <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            View My Orders
          </Link>
        </div>
      </div>
    </main>
  );
}
