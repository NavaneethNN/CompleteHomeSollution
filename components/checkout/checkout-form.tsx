"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { saveGuestOrderToSession } from "@/lib/guest-session";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Tag,
  ShoppingBag,
  Loader2,
  Check,
  CheckCircle2,
  Lock,
  ShieldCheck,
  CreditCard,
  Truck,
  Package,
  Crown,
  BadgePercent,
  Zap,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Store,
  Award,
  AlertCircle,
} from "lucide-react";
import { cleanAustralianSuburb } from "@/lib/data/australian-suburbs";
import { Address } from "@prisma/client";
import { cn } from "@/lib/utils";
import { checkoutTotals } from "@/lib/checkout-totals";
import { isLargeProduct } from "@/lib/manual-delivery";
import {
  isMemberDeliveryServiceCode,
  resolveProductMemberDeliveryMode,
} from "@/lib/member-delivery";
import { STORE_PICKUP_LOCATION } from "@/lib/store-info";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { AddressInput } from "@/lib/validations/address";
import { useCartStore } from "@/store/cart";
import type { ActivePlan } from "@/lib/membership-plan";
import Image from "next/image";

const CheckoutAddressDialog = dynamic(
  () => import("@/components/checkout/checkout-address-dialog").then((m) => m.CheckoutAddressDialog),
  { ssr: false }
);

const CheckoutDeleteAddressDialog = dynamic(
  () => import("@/components/checkout/checkout-delete-address-dialog").then((m) => m.CheckoutDeleteAddressDialog),
  { ssr: false }
);

const PayWayCardFrame = dynamic(
  () => import("@/components/checkout/payway-card-frame").then((m) => m.PayWayCardFrame),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[306px] w-full flex-col items-center justify-center gap-2 bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading secure card form…</p>
      </div>
    ),
  }
);

interface CheckoutFormProps {
  readonly savedAddresses: Address[];
  readonly addressesError?: string;
  readonly isAuthenticated: boolean;
  readonly userId?: string;
  readonly userProfile?: { name: string; phone: string };
  readonly isMember?: boolean;
  /** Enables a clear renewal prompt for a customer whose paid term lapsed. */
  readonly hasExpiredMembership?: boolean;
  readonly memberPriceMap?: Record<string, number | null>;
  readonly activePlan?: ActivePlan;
  readonly usesOnlinePay?: boolean;
  readonly paymentAvailable?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

interface ShippingRate {
  serviceCode: string;
  serviceName: string;
  price: number;
  deliveryTime: string | null;
  quoteToken?: string;
}

export function CheckoutForm({ savedAddresses, addressesError: _addressesError, isAuthenticated, userId, userProfile, isMember, hasExpiredMembership = false, memberPriceMap, activePlan, usesOnlinePay = false, paymentAvailable = true }: CheckoutFormProps) {
  const MEMBERSHIP_PRICE = activePlan?.price ?? 30;
  const membershipLabel = activePlan ? `${activePlan.name} (${activePlan.durationDays >= 365 ? `${Math.round(activePlan.durationDays / 365)}yr` : `${activePlan.durationDays}d`})` : "CHS Membership";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [singleUseTokenId, setSingleUseTokenId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [awaitingToken, setAwaitingToken] = useState(false);
  // REL-2 fix: ref-based guard prevents the order-submission effect from firing
  // more than once per Place Order click, even if React re-renders the component
  // before setAwaitingToken(false) propagates back through state.
  const submissionInFlightRef = useRef(false);
  // REL-5 fix: holds the idempotency key for the current Place Order attempt.
  // Same key is sent on every retry for the same click; a new key is generated
  // on each fresh handlePlaceOrder call so distinct attempts never collide.
  const idempotencyKeyRef = useRef<string | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState(""); // Store the code that was successfully applied
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    pricingKey: string;
    code: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    discount: number;
    subtotal: number;
    discountedSubtotal: number;
    maxDiscount: number | null;
    name?: string;
    memberEligibility?: "ALL" | "MEMBERS_ONLY" | "NON_MEMBERS";
  } | null>(null);
  const [addMembership, setAddMembership] = useState(false);
  const [membershipPerksOpen, setMembershipPerksOpen] = useState(false);

  // Address management state
  const [addresses, setAddresses] = useState<Address[]>(savedAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    savedAddresses.length > 0 ? savedAddresses[0].id : null
  );
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(
    !isAuthenticated || savedAddresses.length === 0
  );
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Guest: store address locally since it won't be saved to DB
  const [guestAddress, setGuestAddress] = useState<(AddressInput & { email?: string }) | null>(null);
  const [guestEmail, setGuestEmail] = useState("");

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  };

  // Fulfillment & Store Pickup state
  const [fulfillmentType, setFulfillmentType] = useState<"DELIVERY" | "STORE_PICKUP">("DELIVERY");
  const [hasLargeItemsState, setHasLargeItemsState] = useState(false);
  const [manualDeliveryAvailable, setManualDeliveryAvailable] = useState<boolean | null>(null);
  const [, setLargeItemMessage] = useState<string | null>(null);

  // Couriers Please shipping rates
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRateCode, setSelectedRateCode] = useState<string | null>(null);
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [shippingAvailable, setShippingAvailable] = useState<boolean | null>(null);
  const [shippingAvailabilityError, setShippingAvailabilityError] = useState<string | null>(null);
  const [shippingAvailabilityAttempt, setShippingAvailabilityAttempt] = useState(0);
  const shippingRequestRef = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    setShippingAvailable(null);
    setShippingAvailabilityError(null);
    fetch("/api/shipping/couriersplease", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (controller.signal.aborted) return;
        const available = response.ok && data.available === true;
        setShippingAvailable(available);
        if (!available) {
          setShippingAvailabilityError(response.status === 429
            ? "Shipping checks are temporarily limited. Please wait a minute, then retry."
            : "Shipping is currently unavailable. Please contact support.");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setShippingAvailable(false);
          setShippingAvailabilityError("We couldn't connect to check shipping availability. Please retry.");
        }
      });
    return () => controller.abort();
  }, [shippingAvailabilityAttempt]);
  // Cart state
  const storedItems = useCartStore((state) => state.items);
  const [freshPrices, setFreshPrices] = useState<
    Record<
      string,
      {
        price: number;
        memberPrice: number | null;
        stock: number;
        weight: number;
        length?: number | null;
        width?: number | null;
        height?: number | null;
        isLargeItem?: boolean;
        memberFreeDelivery?: boolean;
        memberDeliveryCharge?: number | null;
      }
    >
  >({});
  const [pricesReady, setPricesReady] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const productIds = JSON.stringify([...new Set(storedItems.map((item) => item.product.id))]);
  useEffect(() => {
    const controller = new AbortController();
    setPricesReady(false);
    setPricesError(null);
    if (productIds === "[]") return () => controller.abort();
    fetch("/api/cart/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: JSON.parse(productIds) }), signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Could not refresh prices. Reload checkout to try again."); return response.json(); })
      .then((data) => { if (!controller.signal.aborted) { setFreshPrices(data.prices); setPricesReady(true); } })
      .catch((error) => { if (!controller.signal.aborted) setPricesError(error.message); });
    return () => controller.abort();
  }, [productIds]);
  const items = useMemo(
    () =>
      storedItems.map((item) => {
        const fresh = freshPrices[item.product.variantId ?? item.product.id];
        if (item.product.raffleWinnerId) {
          const prod = item.product as typeof item.product & {
            weight?: number;
            length?: number;
            width?: number;
            height?: number;
            isLargeItem?: boolean;
          };
          return {
            ...item,
            product: {
              ...item.product,
              weight: fresh?.weight ?? prod.weight ?? 2,
              length: fresh?.length ?? prod.length,
              width: fresh?.width ?? prod.width,
              height: fresh?.height ?? prod.height,
              isLargeItem: fresh?.isLargeItem ?? prod.isLargeItem,
              stock: Math.max(fresh?.stock ?? 1, 1),
            },
          };
        }
        return {
          ...item,
          product: {
            ...item.product,
            ...fresh,
          },
        };
      }),
    [storedItems, freshPrices]
  );
  const unavailable =
    pricesReady &&
    items.some((item) => {
      if (item.product.raffleWinnerId) return false;
      return !freshPrices[item.product.variantId ?? item.product.id] || item.quantity > item.product.stock;
    });

  const clearCart = useCartStore((state) => state.clearCart);

  // effectiveMember = already a member OR just added membership in this checkout
  const effectiveMember = isMember || (!isMember && addMembership);

  // Resolve memberPrice: prefer fresh DB value from memberPriceMap over stale localStorage value
  const getMemberPrice = (item: typeof items[number]): number | null | undefined => {
    if (item.product.raffleWinnerId) return item.product.price;
    if (!memberPriceMap) return item.product.memberPrice;
    const key = item.product.variantId ?? item.product.id;
    const fresh = memberPriceMap[key];
    return fresh !== undefined ? fresh : item.product.memberPrice;
  };

  const subtotal =
    items.reduce((totalCents, item) => {
      if (item.product.raffleWinnerId) {
        return totalCents + Math.round((item.product.price ?? 0) * 100) * item.quantity;
      }
      const memberPrice = getMemberPrice(item);
      const basePrice = Math.max(0, item.product.price ?? 0);
      const effectivePrice = effectiveMember && memberPrice && memberPrice > 0 ? memberPrice : basePrice;
      return totalCents + Math.round(effectivePrice * 100) * item.quantity;
    }, 0) / 100;
  // Full (non-member) subtotal for savings display
  const fullSubtotal =
    items.reduce(
      (totalCents, item) => totalCents + Math.round(Math.max(0, item.product.price ?? 0) * 100) * item.quantity,
      0
    ) / 100;
  const memberSavings = Math.round((fullSubtotal - subtotal) * 100) / 100;
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  const pricingKey = JSON.stringify([effectiveMember, items.map(item => [item.product.id, item.product.variantId ?? null, item.quantity, item.product.price, getMemberPrice(item)])]);
  const pricingKeyRef = useRef(pricingKey);
  pricingKeyRef.current = pricingKey;
  const couponRequestRef = useRef(0);
  const currentCoupon = appliedCoupon?.pricingKey === pricingKey ? appliedCoupon : null;
  const couponNeedsRefresh = !!appliedCouponCode && !currentCoupon;

  // Calculate totals with proper coupon discount
  // The validation endpoint calculates this from the coupon's eligible items.
  // Reusing that result avoids incorrectly showing a product/category coupon as
  // a discount on the entire cart.
  const displayedSubtotal = currentCoupon?.subtotal ?? subtotal;
  const discount = Math.min(currentCoupon?.discount ?? 0, displayedSubtotal);
  const discountedSubtotal =
    currentCoupon?.discountedSubtotal ?? Math.max(0, Math.round((displayedSubtotal - discount) * 100)) / 100;
  const cartHasLargeItems = useMemo(() => {
    const hasUncoveredLarge = items.some((item) => {
      const prod = item.product as typeof item.product & {
        memberFreeDelivery?: boolean | null;
        memberDeliveryCharge?: number | null;
      };
      const mode = resolveProductMemberDeliveryMode(
        {
          memberFreeDelivery: prod.memberFreeDelivery,
          memberDeliveryCharge: prod.memberDeliveryCharge,
        },
        effectiveMember
      );
      if (mode.type !== "STANDARD") return false;
      return isLargeProduct(item.product);
    });
    return hasUncoveredLarge || hasLargeItemsState;
  }, [items, effectiveMember, hasLargeItemsState]);

  const hasMemberFixedDelivery = useMemo(() => {
    if (!effectiveMember) return false;
    return items.some((item) => {
      const prod = item.product as typeof item.product & {
        memberFreeDelivery?: boolean | null;
        memberDeliveryCharge?: number | null;
      };
      const mode = resolveProductMemberDeliveryMode(
        {
          memberFreeDelivery: prod.memberFreeDelivery,
          memberDeliveryCharge: prod.memberDeliveryCharge,
        },
        true
      );
      return mode.type === "FIXED";
    });
  }, [items, effectiveMember]);

  const isStorePickup = fulfillmentType === "STORE_PICKUP";
  const selectedRate = shippingRates.find((r) => r.serviceCode === selectedRateCode) ?? shippingRates[0] ?? null;
  const freeShipping = !isStorePickup && !cartHasLargeItems && !hasMemberFixedDelivery && (discountedSubtotal >= 1200);
  const shippingCost = isStorePickup ? 0 : freeShipping ? 0 : (selectedRate?.price ?? null);
  const membershipAdd = (!isMember && addMembership) ? MEMBERSHIP_PRICE : 0;
  const { total } = checkoutTotals(discountedSubtotal, shippingCost ?? 0, membershipAdd);
  const isFreeOrder = Math.round(total * 100) === 0;
  const isShippingReady =
    isStorePickup ||
    freeShipping ||
    (shippingCost !== null &&
      (selectedRate?.serviceCode === "MANUAL_DELIVERY" ||
        isMemberDeliveryServiceCode(selectedRate?.serviceCode) ||
        shippingAvailable === true));
  // Net benefit: savings on items minus membership fee
  const netBenefit = memberSavings - MEMBERSHIP_PRICE;

  // Address dialog form & multi-step state
  // Address dialog is lazy-loaded via CheckoutAddressDialog when opened.

  useEffect(() => {
    if (freeShipping) {
      shippingRequestRef.current++;
      setIsFetchingRates(false);
      setRatesError(null);
      setShippingRates([]);
      setSelectedRateCode(null);
    }
  }, [freeShipping]);

  // Couriers Please needs the complete destination, and stale responses must not replace a newer quote.
  const fetchShippingRates = useCallback(
    async (address: AddressInput | Address) => {
      const requestId = ++shippingRequestRef.current;
      const cleanPostcode = (address.postcode || "").replace(/\D/g, "").slice(0, 4);
      if (freeShipping) {
        setIsFetchingRates(false);
        setRatesError(null);
        setShippingRates([]);
        setSelectedRateCode(null);
        return;
      }
      if (!/^\d{4}$/.test(cleanPostcode) || !pricesReady) return;
      setIsFetchingRates(true);
      setRatesError(null);
      setShippingRates([]);
      setSelectedRateCode(null);
      try {
        const cleanAddress = {
          name: address.name?.trim() || "Customer",
          line1: address.line1?.trim() || "",
          line2: address.line2?.trim() || null,
          suburb: cleanAustralianSuburb(address.suburb || ""),
          state: (address.state || "").trim().toUpperCase(),
          postcode: cleanPostcode,
          country: "AU" as const,
          phone: address.phone?.trim() || null,
        };

        const res = await fetch("/api/shipping/couriersplease", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: cleanAddress,
            addMembership: !isMember && addMembership,
            items: items.map(item => ({
              productId: item.product.id,
              variantId: item.product.variantId ?? undefined,
              quantity: item.quantity,
            })),
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (requestId !== shippingRequestRef.current) return;

        if (data.hasLargeItems !== undefined) {
          setHasLargeItemsState(Boolean(data.hasLargeItems));
        }
        if (data.manualDeliveryAvailable !== undefined) {
          setManualDeliveryAvailable(Boolean(data.manualDeliveryAvailable));
        }
        if (data.message) {
          setLargeItemMessage(data.message);
        } else {
          setLargeItemMessage(null);
        }

        if (!res.ok) {
          setRatesError(data.error ?? data.message ?? "Could not fetch shipping rates.");
        } else if (data.rates?.length) {
          setShippingRates(data.rates);
          setSelectedRateCode(data.rates[0].serviceCode);
        } else if (data.hasLargeItems && !data.manualDeliveryAvailable) {
          setRatesError(data.message || `Delivery for large items is not available to postcode ${cleanPostcode}. Please choose Store Pickup.`);
        } else {
          setRatesError("No delivery services available for this postcode.");
        }
      } catch {
        if (requestId === shippingRequestRef.current) setRatesError("Could not connect to shipping service.");
      } finally {
        if (requestId === shippingRequestRef.current) setIsFetchingRates(false);
      }
    },
    [items, pricesReady, freeShipping, isMember, addMembership]
  );

  // Fetch rates when selected saved address changes
  useEffect(() => {
    if (!selectedAddressId) return;
    const addr = addresses.find((a) => a.id === selectedAddressId);
    if (addr?.postcode) fetchShippingRates(addr);
  }, [selectedAddressId, addresses, fetchShippingRates]);

  // Fetch rates when guest address is set
  useEffect(() => {
    if (guestAddress?.postcode) fetchShippingRates(guestAddress);
  }, [guestAddress, fetchShippingRates]);

  // Refetch shipping rates when membership toggle changes so member delivery perks update
  useEffect(() => {
    const activeAddress = selectedAddressId
      ? addresses.find((a) => a.id === selectedAddressId)
      : guestAddress;
    if (activeAddress?.postcode) {
      fetchShippingRates(activeAddress);
    }
  }, [addMembership, addresses, fetchShippingRates, guestAddress, selectedAddressId]);

  // Show cancelled toast
  useEffect(() => {
    if (searchParams.get("cancelled") === "true") {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled. You can try again.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  // Address management functions
  const openAddDialog = () => {
    setEditingAddress(null);
    setIsAddressDialogOpen(true);
  };

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    setIsAddressDialogOpen(true);
  };

  const handleAddressDeleted = (id: string) => {
    const updated = addresses.filter((a) => a.id !== id);
    setAddresses(updated);
    if (selectedAddressId === id) {
      setSelectedAddressId(updated.length > 0 ? updated[0].id : null);
      if (updated.length === 0) {
        setShippingRates([]);
        setSelectedRateCode(null);
        setRatesError(null);
      }
    }
  };

  const applyCoupon = async (codeOverride?: string, revalidation = false) => {
    const code = (codeOverride ?? couponCode).trim();
    if (!code) return;

    const requestId = ++couponRequestRef.current;
    const requestedPricingKey = pricingKey;
    setIsApplyingCoupon(true);

    // Prepare items for coupon validation - use effectiveMember to account for membership toggle
    const itemsForValidation = items.map((item) => {
      return {
        productId: item.product.id,
        variantId: item.product.variantId ?? undefined,
        quantity: item.quantity,
      };
    });

    // CODE-6: Convert to POST with JSON body instead of GET with query params
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          items: itemsForValidation,
          addMembership: !isMember && addMembership,
        }),
      });
      const data = await res.json();
      if (requestId !== couponRequestRef.current || requestedPricingKey !== pricingKeyRef.current) return;

      if (!res.ok) {
        setAppliedCoupon(null);
        setAppliedCouponCode("");
        toast({ title: "Invalid Coupon", description: data.error || "The coupon code is not valid.", variant: "destructive" });
        return;
      }

      setAppliedCoupon({
        pricingKey: requestedPricingKey,
        code: data.coupon.code,
        discountType: data.coupon.discountType,
        discountValue: data.coupon.discountValue,
        discount: data.coupon.discount,
        subtotal: data.coupon.subtotal,
        discountedSubtotal: data.coupon.discountedSubtotal,
        maxDiscount: data.coupon.maxDiscount ?? null,
        name: data.coupon.name,
        memberEligibility: data.coupon.memberEligibility,
      });
      setAppliedCouponCode(code); // Store the applied code for re-validation
      setCouponCode(""); // Clear input after successful application
      if (!revalidation) toast({ title: "Coupon Applied", description: `${data.coupon.name} - ${data.coupon.discountType === "PERCENTAGE" ? data.coupon.discountValue + "%" : "$" + data.coupon.discountValue} off` });
    } catch (error) {
      if (requestId !== couponRequestRef.current || requestedPricingKey !== pricingKeyRef.current) return;
      setAppliedCoupon(null);
      setAppliedCouponCode("");
      console.error("Coupon validation error:", error);
      toast({ title: "Error", description: "Failed to validate coupon. Please try again.", variant: "destructive" });
    } finally {
      if (requestId === couponRequestRef.current) setIsApplyingCoupon(false);
    }
  };

  // Any checkout-affecting change invalidates the previous idempotency key so
  // editing address, shipping, pickup/delivery, or coupon after backing out
  // never replays a stale PENDING order or payment session.
  const checkoutPayloadKey = JSON.stringify([
    pricingKey,
    appliedCouponCode,
    appliedCoupon?.code ?? null,
    fulfillmentType,
    selectedAddressId,
    guestAddress,
    guestEmail.trim().toLowerCase(),
    shippingCost,
    selectedRateCode,
  ]);
  useEffect(() => {
    try { sessionStorage.removeItem("chs_checkout_idempotency_key"); } catch {}
    idempotencyKeyRef.current = null;
  }, [checkoutPayloadKey]);

  // Every price/quantity/membership change affects coupon amounts, including ALL coupons.
  useEffect(() => {
    if (appliedCouponCode) void applyCoupon(appliedCouponCode, true);
    // Revalidate only when inputs change, not when the response updates coupon state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey]);

  const removeCoupon = () => {
    couponRequestRef.current++;
    setIsApplyingCoupon(false);
    setAppliedCoupon(null);
    setAppliedCouponCode("");
    setCouponCode("");
  };
  const raffleWinnerId =
    searchParams.get("raffleWinnerId") ||
    items.find((i) => i.product.raffleWinnerId)?.product.raffleWinnerId ||
    null;
  const rafflePrizeItem = items.find((i) => i.product.raffleWinnerId);

  useEffect(() => {
    const queryWinnerId = searchParams.get("raffleWinnerId");
    if (!queryWinnerId) return;
    const exists = storedItems.some((i) => i.product.raffleWinnerId === queryWinnerId);
    if (!exists) {
      import("@/lib/actions/raffle").then(({ prepareRafflePrizeForCheckout }) => {
        prepareRafflePrizeForCheckout(queryWinnerId).then((res) => {
          if (res.success && res.cartItem) {
            useCartStore.getState().setRafflePrizeItem(res.cartItem);
          }
        });
      });
    }
  }, [searchParams, storedItems]);

  // Place order — validate then request a PayWay single-use token
  const submitOrderWithToken = async (tokenId: string) => {
    if (couponNeedsRefresh || isApplyingCoupon) {
      submissionInFlightRef.current = false;
      setAwaitingToken(false);
      setIsProcessing(false);
      return;
    }
    setAwaitingToken(false);
    setIsProcessing(true);
    try {      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // OnlinePay redirects to its hosted checkout and has no PayWay token.
          ...(tokenId ? { singleUseTokenId: tokenId } : {}),
          items: items.map((item) => ({
            productId: item.product.id,
            variantId: item.product.variantId || undefined,
            quantity: item.quantity,
          })),
          ...(isAuthenticated
            ? { savedAddressId: selectedAddressId }
            : { address: guestAddress }),
          guestEmail: !isAuthenticated ? guestEmail.trim().toLowerCase() : undefined,
          fulfillmentType: isStorePickup
            ? "STORE_PICKUP"
            : selectedRate?.serviceCode === "MANUAL_DELIVERY" || selectedRateCode === "MANUAL_DELIVERY"
            ? "MANUAL_DELIVERY"
            : fulfillmentType,
          shippingRateCode: isStorePickup ? "STORE_PICKUP" : (selectedRateCode ?? undefined),
          shippingCost: shippingCost ?? 0,
          shippingQuoteToken: isStorePickup ? undefined : selectedRate?.quoteToken,
          couponCode: appliedCoupon?.code || undefined,
          addMembership: !isMember && addMembership,
          // REL-5: send the same key on every retry for this attempt
          idempotencyKey: idempotencyKeyRef.current ?? undefined,
          raffleWinnerId: raffleWinnerId || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.retryWithNewKey || [400, 401, 402, 422].includes(response.status)) {
          idempotencyKeyRef.current = null;
          try { sessionStorage.removeItem("chs_checkout_idempotency_key"); } catch {}
        }
        let msg = data.error || "Payment failed. Please try again.";
        if (
          msg.includes("parameter is invalid") ||
          msg.includes("details property") ||
          msg.includes("requests body") ||
          msg.includes("templated parameters")
        ) {
          msg = "We couldn't set up your payment session. Please check your contact and address details, or try again.";
        }
        setPaymentError(msg);
        setSingleUseTokenId(null); // token was consumed — user must re-enter card
        toast({ title: response.status === 503 ? "Checkout Unavailable" : "Payment Notice", description: msg, variant: "destructive" });
        submissionInFlightRef.current = false; // allow retry
        setIsProcessing(false);
        return;
      }
      if (data.status === "success" || data.status === "pending") {
        try { sessionStorage.removeItem("chs_checkout_idempotency_key"); } catch {}
        if (data.status === "success") {
          clearCart();
        }
        if (!isAuthenticated && data.guestToken) {
          saveGuestOrderToSession({
            orderId: data.orderId,
            guestToken: data.guestToken,
            email: guestEmail.trim().toLowerCase(),
          });
        }
        const confirmUrl = isAuthenticated
          ? `/order-confirmation/${data.orderId}`
          : `/order-confirmation/${data.orderId}?token=${encodeURIComponent(data.guestToken ?? "")}`;
        router.push(confirmUrl);
      } else if (data.status === "redirect" && data.checkoutUrl) {
        if (!isAuthenticated && data.guestToken) {
          saveGuestOrderToSession({
            orderId: data.orderId,
            guestToken: data.guestToken,
            email: guestEmail.trim().toLowerCase(),
          });
        }
        window.location.assign(data.checkoutUrl);
      } else {
        toast({ title: "Error", description: "Unexpected response. Please contact support.", variant: "destructive" });
        submissionInFlightRef.current = false; // allow retry
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
      submissionInFlightRef.current = false; // allow retry
      setIsProcessing(false);
    }
  };

  // REL-2 fix: Guard with a ref so this effect is strictly one-shot per Place
  // Order click. React state updates are asynchronous — without the ref, a
  // re-render could cause the effect to fire a second time with the same
  // awaitingToken=true and singleUseTokenId values before setAwaitingToken(false)
  // has propagated, submitting the order (and consuming the single-use token)
  // twice and producing a guaranteed payment failure on the second attempt.
  // The ref is set synchronously inside the effect (before any await), so even
  // multiple rapid re-renders cannot trigger a second submission.
  useEffect(() => {
    if (awaitingToken && singleUseTokenId && !submissionInFlightRef.current) {
      submissionInFlightRef.current = true; // claim the slot synchronously
      submitOrderWithToken(singleUseTokenId);
    }
  // submitOrderWithToken deliberately reads the current checkout state when a
  // token arrives; including it would recreate this one-shot effect each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingToken, singleUseTokenId]);

  const handlePlaceOrder = () => {
    if (!isFreeOrder && !paymentAvailable) return;
    if (items.length === 0) {
      toast({ title: "Cart is empty", description: "Add items to your cart first.", variant: "destructive" });
      return;
    }
    if (!isAuthenticated) {
      if (!guestEmail.trim()) {
        setIsAddressDialogOpen(true);
        toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
        return;
      }
      if (!isValidEmail(guestEmail)) {
        setIsAddressDialogOpen(true);
        toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
        return;
      }
    }
    const hasAddress = isAuthenticated ? !!selectedAddressId : !!guestAddress;
    if (!hasAddress) {
      setIsAddressDialogOpen(true);
      toast({ title: "Address required", description: "Please enter your shipping address.", variant: "destructive" });
      return;
    }
    if (!isStorePickup && !freeShipping && !selectedRateCode) {
      toast({ title: "Select a shipping option", description: "Please choose a shipping service.", variant: "destructive" });
      return;
    }
    setPaymentError(null);
    setSingleUseTokenId(null);
    submissionInFlightRef.current = false; // reset guard for this new attempt
    if (!idempotencyKeyRef.current) {
      try {
        idempotencyKeyRef.current = sessionStorage.getItem("chs_checkout_idempotency_key");
      } catch {}
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
        try {
          sessionStorage.setItem("chs_checkout_idempotency_key", idempotencyKeyRef.current);
        } catch {}
      }
    }
    if (isFreeOrder || usesOnlinePay) {
      submissionInFlightRef.current = true;
      submitOrderWithToken("");
      return;
    }
    setAwaitingToken(true);
    document
      .getElementById("payway-credit-card-iframe")
      ?.dispatchEvent(new CustomEvent("payway:getToken"));
  };

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-bold text-foreground">Your cart is empty</h2>
        <p className="mt-2 text-sm text-muted-foreground">Add some items to get started.</p>
        <Button className="mt-6" onClick={() => router.push("/products")}>
          Browse Products
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start w-full min-w-0 max-w-full">
      {/* Main Content — form sections: order-2 on mobile, natural on lg */}
      <div className="order-2 space-y-4 lg:order-1 lg:space-y-6 min-w-0 max-w-full">
        {/* Raffle Winner Banner */}
        {rafflePrizeItem && (
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 sm:p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                    <Award className="h-3 w-3" /> Raffle Prize Claim
                  </span>
                  {rafflePrizeItem.product.price === 0 ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border">
                      100% Free Gift
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border">
                      Winner Price: ${rafflePrizeItem.product.price}
                    </span>
                  )}
                </div>
                <h2 className="text-sm sm:text-base font-bold text-foreground mt-1">
                  {rafflePrizeItem.product.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rafflePrizeItem.product.price === 0
                    ? "Congratulations! Your prize product is free ($0.00). Please select your delivery address below so shipping charges can be calculated and your prize dispatched."
                    : `Congratulations! Your special winner price ($${rafflePrizeItem.product.price}) is unlocked. Please select your delivery address below to complete your order.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Order Items */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            Items ({itemCount})
          </h2>
        <div className="mt-3 divide-y divide-border">
            {items.map((item, index) => {
              const memberPrice = getMemberPrice(item);
              const basePrice = Math.max(0, item.product.price ?? 0);
              const effectivePrice = effectiveMember && memberPrice && memberPrice > 0 ? memberPrice : basePrice;
              const hasMemberDiscount = effectiveMember && memberPrice && memberPrice > 0 && memberPrice < basePrice;
              const itemKey = `${item.product.id ?? 'unknown'}-${item.product.variantId ?? 'default'}-${index}`;
              const productUrl = `/products/${item.product.slug}${item.product.variantId ? `?variant=${encodeURIComponent(item.product.variantId)}` : ""}`;
              return (
                <div key={itemKey} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <Link href={productUrl} className="relative h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0 block hover:opacity-80 transition-opacity sm:h-16 sm:w-16">
                    {item.product.images?.[0] && (
                      <Image
                        src={item.product.images[0]}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                      />
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={productUrl} className="text-sm font-medium text-foreground truncate hover:text-primary transition-colors block">{item.product.name}</Link>
                    {item.product.raffleWinnerId ? (
                      <p className="text-xs font-semibold text-primary mt-0.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {item.product.price === 0 ? "100% Free Winner Gift" : `Special Winner Price: $${item.product.price}`}
                      </p>
                    ) : item.product.variantLabel ? (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.product.variantLabel}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity}</p>
                    {hasMemberDiscount && (
                      <p className="text-xs text-primary font-semibold mt-0.5 flex items-center gap-1">
                        <Crown className="h-2.5 w-2.5" />
                        Member price applied
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {currencyFormatter.format(effectivePrice * item.quantity)}
                    </p>
                    {hasMemberDiscount && (
                      <p className="text-xs text-muted-foreground line-through">
                        {currencyFormatter.format(basePrice * item.quantity)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Fulfillment Method Selection: Delivery vs Store Pickup ── */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Truck className="h-4 w-4 text-primary" />
              Fulfillment Method
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Delivery Option */}
            <button
              type="button"
              onClick={() => setFulfillmentType("DELIVERY")}
              className={cn(
                "flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all",
                fulfillmentType === "DELIVERY"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-border/80 bg-background"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Truck className="h-4 w-4 text-primary" />
                  Home Delivery
                </span>
                <div className={cn(
                  "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                  fulfillmentType === "DELIVERY" ? "border-primary" : "border-muted-foreground/40"
                )}>
                  {fulfillmentType === "DELIVERY" && <div className="h-2 w-2 rounded-full bg-primary" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Dispatched directly to your address with full tracking.
              </p>
            </button>

            {/* Store Pickup Option */}
            <button
              type="button"
              onClick={() => setFulfillmentType("STORE_PICKUP")}
              className={cn(
                "flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all",
                fulfillmentType === "STORE_PICKUP"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-border/80 bg-background"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Store className="h-4 w-4 text-primary" />
                  Store Pickup
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    FREE
                  </span>
                  <div className={cn(
                    "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                    fulfillmentType === "STORE_PICKUP" ? "border-primary" : "border-muted-foreground/40"
                  )}>
                    {fulfillmentType === "STORE_PICKUP" && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Pick up directly from our Golden Grove showroom. By appointment.
              </p>
            </button>
          </div>

          {/* Large Item Information Alert */}
          {cartHasLargeItems && (
            <div className="rounded-xl border border-border bg-secondary/40 p-3.5 text-xs text-foreground flex items-start gap-2.5">
              <Package className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Bulky Furniture in Cart</p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  Bulky items require specialized delivery to covered postcodes, or you can select free Store Pickup from our showroom.
                </p>
              </div>
            </div>
          )}

          {/* Store Pickup Location Details */}
          {fulfillmentType === "STORE_PICKUP" && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-primary" />
                    {STORE_PICKUP_LOCATION.name}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {STORE_PICKUP_LOCATION.fullAddress}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <strong>Hours:</strong> {STORE_PICKUP_LOCATION.hours}
                  </p>
                </div>
                <span className="self-start font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-xs border border-emerald-200">
                  $0.00 Delivery Fee
                </span>
              </div>
              <div className="pt-2 border-t border-border text-muted-foreground space-y-1">
                <p>
                  <strong>How Pickup Works:</strong> Complete your payment online today. Our team will contact you by phone or email to coordinate your pickup appointment before collection.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Shipping / Contact Address */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {fulfillmentType === "STORE_PICKUP" ? "Customer Contact & Billing Details" : "Shipping Address"}
            </h2>
            {fulfillmentType === "STORE_PICKUP" && (
              <p className="text-xs text-muted-foreground">
                Please ensure your phone number is valid so our store team can contact you regarding your pickup appointment.
              </p>
            )}
          </div>

          {/* Saved address cards */}
          {isAuthenticated && addresses.length > 0 && (
            <div className="mt-4 space-y-2">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all",
                    selectedAddressId === address.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                  onClick={() => setSelectedAddressId(address.id)}
                >
                  <div className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    selectedAddressId === address.id ? "border-primary bg-primary" : "border-muted-foreground/40"
                  )}>
                    {selectedAddressId === address.id && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{address.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {address.line1}{address.line2 ? `, ${address.line2}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{address.suburb}, {address.state} {address.postcode}</p>
                    <p className="text-xs text-muted-foreground">{address.phone}</p>
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditDialog(address)} className="h-7 w-7 p-0">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteConfirmId(address.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={openAddDialog}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Add a new address
              </button>
            </div>
          )}

          {/* No saved addresses (authenticated) — prompt to add */}
          {isAuthenticated && addresses.length === 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={openAddDialog}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Add a delivery address
              </button>
            </div>
          )}

          {/* Guest — show saved address summary or prompt */}
          {!isAuthenticated && (
            <div className="mt-4">
              {guestAddress ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{guestAddress.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">
                          {guestAddress.line1}{guestAddress.line2 ? `, ${guestAddress.line2}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{guestAddress.suburb}, {guestAddress.state} {guestAddress.postcode}</p>
                        <p className="text-xs text-muted-foreground">{guestAddress.phone}</p>
                        {guestAddress.email && <p className="text-xs text-muted-foreground break-all">{guestAddress.email}</p>}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={openAddDialog} className="h-7 px-2 text-xs shrink-0">
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openAddDialog}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  Enter your delivery address
                </button>
              )}
            </div>
          )}
        </section>

        {/* Coupon Code */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground mb-4">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Promo Code
          </h2>

          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <Check className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm font-medium text-green-800 truncate">
                  {appliedCoupon.code} &mdash; {appliedCoupon.discountType === "PERCENTAGE" ? appliedCoupon.discountValue + "%" : "$" + appliedCoupon.discountValue} off
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={removeCoupon} className="text-xs h-7 shrink-0">
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 min-w-0">
              <Input
                placeholder="Enter code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isApplyingCoupon && applyCoupon()}
                disabled={isApplyingCoupon}
                className="h-10 flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => applyCoupon()}
                disabled={!couponCode.trim() || isApplyingCoupon}
                className="h-10 px-5 shrink-0"
              >
                {isApplyingCoupon ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Order Summary Sidebar — order-1 on mobile (top), order-2 on desktop (right column) */}
      <aside className="order-1 lg:order-2 lg:sticky lg:top-24 space-y-6 min-w-0 max-w-full">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Order Summary</h2>

          <div className="mt-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{memberSavings > 0 ? "Subtotal before member savings" : "Subtotal"}</span>
              <span className="font-medium">{currencyFormatter.format(memberSavings > 0 ? fullSubtotal : displayedSubtotal)}</span>
            </div>
            {memberSavings > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Member savings
                </span>
                <span className="font-medium text-primary">-{currencyFormatter.format(memberSavings)}</span>
              </div>
            )}
            {memberSavings > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Member subtotal</span>
                <span className="font-medium">{currencyFormatter.format(displayedSubtotal)}</span>
              </div>
            )}
            {discount > 0 && appliedCoupon && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Discount ({appliedCoupon.code})</span>
                <span className="font-medium text-green-600">-{currencyFormatter.format(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping / Fulfillment</span>
              <span className="font-medium">
                {isStorePickup ? (
                  <span className="text-emerald-700 font-semibold">Free (Store Pickup)</span>
                ) : freeShipping ? (
                  <span className="text-green-600 font-semibold">Free</span>
                ) : isFetchingRates ? (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Calculating…
                  </span>
                ) : shippingCost !== null ? (
                  currencyFormatter.format(shippingCost)
                ) : (
                  <span className="text-muted-foreground text-xs">Enter postcode</span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST</span>
              <span className="font-medium text-emerald-600">Included in price</span>
            </div>
            {membershipAdd > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium flex items-center gap-1">
                  <Crown className="h-3 w-3" /> {membershipLabel}
                </span>
                <span className="font-medium text-primary">+{currencyFormatter.format(MEMBERSHIP_PRICE)}</span>
              </div>
            )}

            <Separator className="my-3" />

            <div className="flex justify-between items-center">
              <span className="text-base font-bold">Total</span>
              <span className="text-xl font-black">
                {isStorePickup || freeShipping || shippingCost !== null
                  ? currencyFormatter.format(total)
                  : "—"}
              </span>
            </div>
          </div>

          {freeShipping && !isStorePickup && (
            <p className="mt-3 text-xs text-green-600 font-medium flex items-center gap-1">
              Free shipping on orders of $1,200 or more
            </p>
          )}

          {/* Store Pickup summary indicator */}
          {isStorePickup && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-primary" />
                Fulfillment Option
              </p>
              <div className="w-full flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-left text-xs">
                <span className="flex items-center gap-2.5">
                  <Store className="h-4 w-4 text-foreground shrink-0" />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground">Store Pickup</span>
                    <span className="text-[11px] text-muted-foreground leading-snug">
                      Pickup by appointment · Golden Grove SA
                    </span>
                  </span>
                </span>
                <span className="font-bold text-foreground">FREE</span>
              </div>
            </div>
          )}

          {/* Delivery shipping options */}
          {!isStorePickup && !freeShipping && (
            <div className="mt-4">
              {isFetchingRates && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Fetching shipping rates…
                </div>
              )}
              {ratesError && !isFetchingRates && (
                <div className="space-y-2 py-1">
                  <p className="text-xs text-destructive">{ratesError}</p>
                  {cartHasLargeItems && !manualDeliveryAvailable && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFulfillmentType("STORE_PICKUP")}
                      className="w-full text-xs font-semibold border-border bg-secondary hover:bg-secondary/80 text-foreground"
                    >
                      <Store className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      Select Free Store Pickup Instead
                    </Button>
                  )}
                </div>
              )}
              {!isFetchingRates && shippingRates.length > 0 && (() => {
                const bestRate = shippingRates[0];
                return (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      Delivery Option
                    </p>
                    <div className="w-full flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-left text-xs">
                      <span className="flex items-center gap-2.5">
                        <Package className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground">
                            {bestRate.serviceCode === "MANUAL_DELIVERY"
                              ? bestRate.serviceName
                              : bestRate.serviceCode === "MEMBER_FREE_DELIVERY"
                              ? "Free Delivery (Member Perk)"
                              : bestRate.serviceCode === "MEMBER_FIXED_DELIVERY"
                              ? "Standard Delivery (Member Rate)"
                              : "Standard Delivery"}
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-snug">
                            {bestRate.serviceCode === "MANUAL_DELIVERY"
                              ? (bestRate.deliveryTime || "Delivery arranged by our team")
                              : bestRate.serviceCode === "MEMBER_FREE_DELIVERY"
                              ? "Exclusive member delivery · Tracked dispatch"
                              : bestRate.serviceCode === "MEMBER_FIXED_DELIVERY"
                              ? "Fixed member delivery fee · Tracked dispatch"
                              : "5–7 working days • Tracked dispatch"}
                          </span>
                        </span>
                      </span>
                      <span className="font-bold text-foreground">
                        {bestRate.price === 0 ? "FREE" : currencyFormatter.format(bestRate.price)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Membership Add-on Card (BookMyShow style) ── */}
          {isAuthenticated && !isMember && (
            <div className={cn(
              "mt-4 rounded-xl border-2 transition-all duration-200 overflow-hidden min-w-0 w-full",
              addMembership ? "border-primary bg-primary/5" : "border-border bg-secondary/50"
            )}>
              {/* Toggle header */}
              <button
                type="button"
                onClick={() => setAddMembership(!addMembership)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Checkbox */}
                  <div className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                    addMembership ? "border-primary bg-primary" : "border-muted-foreground/40 bg-white"
                  )}>
                    {addMembership && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <Crown className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-bold text-foreground">
                        {hasExpiredMembership ? "Renew CHS Membership" : "Add CHS Membership"}
                      </span>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">+{currencyFormatter.format(MEMBERSHIP_PRICE)}</span>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Autopay Enabled
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasExpiredMembership
                        ? "Your membership has expired — renew now to restore member prices and benefits."
                        : memberSavings > 0
                        ? netBenefit > 0
                          ? `Save ${currencyFormatter.format(memberSavings)} on this order alone — net gain: ${currencyFormatter.format(netBenefit)}`
                          : `Save ${currencyFormatter.format(memberSavings)} on this order + all future orders`
                        : `Save up to ${activePlan?.discountPercent ?? 30}% on this & every future order`}
                    </p>
                  </div>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setMembershipPerksOpen(!membershipPerksOpen); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setMembershipPerksOpen(!membershipPerksOpen); } }}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1"
                  aria-label={membershipPerksOpen ? "Hide perks" : "Show perks"}
                >
                  {membershipPerksOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {/* Expandable perks */}
              {membershipPerksOpen && (
                <div className="px-4 pb-3 border-t border-border/60">
                  <p className="text-xs font-semibold text-foreground mt-2 mb-2">What you get:</p>
                  <div className="space-y-1.5">
                    {[
                      { Icon: BadgePercent, text: "5% off (up to $30) on every item or exclusive member prices" },
                      { Icon: ShieldCheck,  text: "3-year extended warranty" },
                      { Icon: Zap,          text: "Early access to sales & new arrivals" },
                    ].map(({ Icon, text }) => (
                      <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="h-3 w-3 text-primary shrink-0" />
                        {text}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {activePlan ? `${activePlan.name} · activates immediately on payment` : "Annual membership · activates immediately on payment"}
                    {" • Autopay is enabled by default to ensure uninterrupted benefits (manage or cancel anytime in account settings)."}
                  </p>
                </div>
              )}

              {/* Active confirmation strip */}
              {addMembership && (
                <div className="px-4 py-2.5 bg-primary/10 border-t border-primary/20 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-xs font-semibold text-primary">Membership added — activates after payment</p>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Autopay enabled by default
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Payment Details Section: For $0 free orders, no payment card is needed */}
          {isFreeOrder ? (
            <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
              <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <span>100% Free Order</span>
              </div>
              <p className="text-xs text-emerald-800">
                No payment card required. Your order will be confirmed immediately upon submission.
              </p>
            </div>
          ) : paymentAvailable && !usesOnlinePay ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Card Details
              </p>
              <PayWayCardFrame
                onTokenReady={(token) => {
                  setSingleUseTokenId(token);
                  setPaymentError(null);
                  // token is set; the useEffect below will fire submitOrderWithToken
                }}
                onError={(msg) => {
                  submissionInFlightRef.current = false;
                  setPaymentError(msg);
                  setAwaitingToken(false);
                  setIsProcessing(false);
                }}
                disabled={isProcessing}
              />
              {paymentError && (
                <p className="mt-2 text-xs text-destructive font-medium">{paymentError}</p>
              )}
            </div>
          ) : null}

          {!isFreeOrder && !paymentAvailable && <p role="alert" className="mt-4 text-sm text-destructive">Payment checkout is temporarily unavailable. Please try again later.</p>}
          {usesOnlinePay && paymentError && (
            <div role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5 text-destructive flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
              <div className="flex-1 space-y-0.5">
                <p className="text-xs font-semibold text-destructive">Checkout Notice</p>
                <p className="text-xs text-destructive/90 leading-relaxed">{paymentError}</p>
              </div>
            </div>
          )}
          {pricesError && <p role="alert" className="mt-2 text-sm text-destructive">{pricesError}</p>}
          {unavailable && <p role="alert" className="mt-2 text-sm text-destructive">An item is unavailable or exceeds stock. Update your cart before paying.</p>}
          {shippingAvailable === false && <div className="mt-2">
            <p role="alert" className="text-sm text-destructive">{shippingAvailabilityError}</p>
            <Button type="button" variant="outline" className="mt-2" onClick={() => {
              setShippingAvailable(null);
              setShippingAvailabilityAttempt(attempt => attempt + 1);
            }}>Retry shipping check</Button>
          </div>}
          {/* Place Order Button — hidden on mobile (sticky bottom bar handles it) */}
          <Button
            className="mt-5 hidden w-full h-12 text-sm font-semibold lg:flex"
            onClick={handlePlaceOrder}
            disabled={(!isFreeOrder && !paymentAvailable) || !isShippingReady || !pricesReady || unavailable || couponNeedsRefresh || isApplyingCoupon || isProcessing || awaitingToken || items.length === 0}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {isFreeOrder ? <Sparkles className="mr-2 h-4 w-4" /> : <CreditCard className="mr-2 h-4 w-4" />}
                {isFreeOrder
                  ? (rafflePrizeItem ? "Claim Free Prize & Confirm Order" : "Confirm Free Order")
                  : addMembership && !isMember
                  ? `Pay ${isStorePickup || freeShipping || shippingCost !== null ? currencyFormatter.format(total) : "—"} & Join`
                  : isStorePickup
                  ? "Pay & Reserve for Store Pickup"
                  : "Place Order & Pay"}
              </>
            )}
          </Button>

          {!isFreeOrder && paymentAvailable && <p className="mt-3 hidden text-center text-[11px] text-muted-foreground leading-relaxed lg:block">
            Your payment is processed securely by {usesOnlinePay ? "Westpac OnlinePay" : "PayWay (Westpac)"}. Card details never touch our servers.
          </p>}

          {/* Trust badges — hidden on mobile */}
          <div className="mt-5 hidden items-center justify-center gap-4 border-t border-border pt-4 lg:flex">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              <span>SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>PCI Compliant</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile sticky bottom CTA ─────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground leading-none">Order total</p>
            <p className="mt-0.5 text-lg font-black text-foreground leading-none">
              {isStorePickup || freeShipping || shippingCost !== null
                ? currencyFormatter.format(total)
                : "—"}
            </p>
          </div>
          <Button
            className="h-11 min-w-[140px] sm:min-w-[160px] rounded-xl text-sm font-bold shrink-0"
            onClick={handlePlaceOrder}
            disabled={(!isFreeOrder && !paymentAvailable) || !isShippingReady || !pricesReady || unavailable || couponNeedsRefresh || isApplyingCoupon || isProcessing || awaitingToken || items.length === 0}
          >
            {isProcessing ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Processing...</>
            ) : (
              <><Lock className="mr-1.5 h-3.5 w-3.5" />
                {isFreeOrder
                  ? (rafflePrizeItem ? "Claim Free Prize" : "Confirm Order")
                  : addMembership && !isMember
                  ? "Pay & Join"
                  : isStorePickup
                  ? "Pay & Reserve"
                  : "Place Order"}</>
            )}
          </Button>
        </div>
      </div>

      {isAddressDialogOpen && (
        <CheckoutAddressDialog
          open={isAddressDialogOpen}
          onOpenChange={setIsAddressDialogOpen}
          editingAddress={editingAddress}
          onClearEditing={() => setEditingAddress(null)}
          isAuthenticated={isAuthenticated}
          userId={userId}
          userProfile={userProfile}
          guestEmail={guestEmail}
          onGuestEmailChange={setGuestEmail}
          guestAddress={guestAddress}
          onGuestAddressSaved={setGuestAddress}
          onAddressCreated={(address) => {
            setAddresses((prev) => [address, ...prev]);
            setSelectedAddressId(address.id);
          }}
          onAddressUpdated={(address) => {
            setAddresses((prev) => prev.map((a) => (a.id === address.id ? address : a)));
          }}
        />
      )}

      {deleteConfirmId && (
        <CheckoutDeleteAddressDialog
          addressId={deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          onDeleted={handleAddressDeleted}
        />
      )}
    </div>
  );
}
