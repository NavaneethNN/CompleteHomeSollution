"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Tag,
  ShoppingBag,
  Loader2,
  Check,
  Lock,
  ShieldCheck,
  CreditCard,
  Building,
  X,
  Truck,
  Package,
  Navigation,
  Globe,
  Crown,
  BadgePercent,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Address } from "@prisma/client";
import { cn } from "@/lib/utils";
import { checkoutTotals } from "@/lib/checkout-totals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { addressSchema, AddressInput } from "@/lib/validations/address";
import {
  createAddress,
  updateAddress,
  deleteAddress,
} from "@/lib/actions/address";
import { useCartStore } from "@/store/cart";
import type { ActivePlan } from "@/lib/membership-plan";
import Image from "next/image";
import { AddressAutocomplete } from "@/components/account/address-autocomplete";
import { SuburbSelector } from "@/components/account/suburb-selector";
import { PayWayCardFrame, triggerPayWayGetToken } from "@/components/checkout/payway-card-frame";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AU_STATES = [
  { value: "ACT", label: "Australian Capital Territory" },
  { value: "NSW", label: "New South Wales" },
  { value: "NT", label: "Northern Territory" },
  { value: "QLD", label: "Queensland" },
  { value: "SA", label: "South Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "VIC", label: "Victoria" },
  { value: "WA", label: "Western Australia" },
];

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

export function CheckoutForm({ savedAddresses, addressesError: _addressesError, isAuthenticated, userId: _userId, userProfile, isMember, hasExpiredMembership = false, memberPriceMap, activePlan, usesOnlinePay = false, paymentAvailable = true }: CheckoutFormProps) {
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
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Guest: store address locally since it won't be saved to DB
  const [guestAddress, setGuestAddress] = useState<(AddressInput & { email?: string }) | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestEmailError, setGuestEmailError] = useState<string | null>(null);

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  };

  // Ship123 shipping rates
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRateCode, setSelectedRateCode] = useState<string | null>(null);
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [shippingAvailable, setShippingAvailable] = useState<boolean | null>(null);
  const shippingRequestRef = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/shipping/ship123", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!controller.signal.aborted) setShippingAvailable(response.ok && data.available === true);
      })
      .catch(() => { if (!controller.signal.aborted) setShippingAvailable(false); });
    return () => controller.abort();
  }, []);
  // Cart state
  const storedItems = useCartStore((state) => state.items);
  const [freshPrices, setFreshPrices] = useState<Record<string, { price: number; memberPrice: number | null; stock: number; weight: number }>>({});
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
  const items = useMemo(() => storedItems.map((item) => ({ ...item, product: { ...item.product, ...freshPrices[item.product.variantId ?? item.product.id] } })), [storedItems, freshPrices]);
  const unavailable = pricesReady && items.some((item) => !freshPrices[item.product.variantId ?? item.product.id] || item.quantity > item.product.stock);

  const clearCart = useCartStore((state) => state.clearCart);

  // effectiveMember = already a member OR just added membership in this checkout
  const effectiveMember = isMember || (!isMember && addMembership);

  // Resolve memberPrice: prefer fresh DB value from memberPriceMap over stale localStorage value
  const getMemberPrice = (item: typeof items[number]): number | null | undefined => {
    if (!memberPriceMap) return item.product.memberPrice;
    const key = item.product.variantId ?? item.product.id;
    const fresh = memberPriceMap[key];
    return fresh !== undefined ? fresh : item.product.memberPrice;
  };

  const subtotal = items.reduce((total, item) => {
    const memberPrice = getMemberPrice(item);
    const basePrice = Math.max(0, item.product.price ?? 0);
    const effectivePrice = effectiveMember && memberPrice && memberPrice > 0 ? memberPrice : basePrice;
    return total + effectivePrice * item.quantity;
  }, 0);
  // Full (non-member) subtotal for savings display
  const fullSubtotal = items.reduce((total, item) => total + Math.max(0, item.product.price ?? 0) * item.quantity, 0);
  const memberSavings = fullSubtotal - subtotal;
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
  const discountedSubtotal = currentCoupon?.discountedSubtotal ?? displayedSubtotal - discount;
  const selectedRate = shippingRates.find((r) => r.serviceCode === selectedRateCode);
  const freeShipping = effectiveMember || discountedSubtotal >= 1200;
  const shippingCost = freeShipping ? 0 : (selectedRate?.price ?? null);
  const membershipAdd = (!isMember && addMembership) ? MEMBERSHIP_PRICE : 0;
  const { tax: gst, total } = checkoutTotals(discountedSubtotal, shippingCost ?? 0, membershipAdd);
  // Net benefit: savings on items minus membership fee
  const netBenefit = memberSavings - MEMBERSHIP_PRICE;

  // Address dialog form
  const {
    register: registerAddress,
    handleSubmit: handleAddressSubmit,
    reset: resetAddress,
    setValue: setAddressValue,
    formState: { errors: addressErrors },
    watch: watchAddress,
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      name: userProfile?.name || "",
      phone: userProfile?.phone || "",
      line1: "",
      line2: undefined,
      suburb: "",
      state: "",
      postcode: "",
      country: "AU",
    },
  });

  const addressState = watchAddress("state");

  // Ship123 needs the complete destination, and stale responses must not replace a newer quote.
  const fetchShip123Rates = useCallback(
    async (address: AddressInput | Address) => {
      const requestId = ++shippingRequestRef.current;
      if (!/^\d{4}$/.test(address.postcode) || !pricesReady || freeShipping) return;
      setIsFetchingRates(true);
      setRatesError(null);
      setShippingRates([]);
      setSelectedRateCode(null);
      try {
        const res = await fetch("/api/shipping/ship123", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            items: items.map(item => ({
              productId: item.product.id,
              variantId: item.product.variantId,
              quantity: item.quantity,
            })),
          }),
        });
        const data = await res.json();
        if (requestId !== shippingRequestRef.current) return;
        if (!res.ok) {
          setRatesError(data.error ?? "Could not fetch shipping rates.");
        } else if (data.rates?.length) {
          setShippingRates(data.rates);
          setSelectedRateCode(data.rates[0].serviceCode);
        } else {
          setRatesError("No shipping services available for this postcode.");
        }
      } catch {
        if (requestId === shippingRequestRef.current) setRatesError("Could not connect to shipping service.");
      } finally {
        if (requestId === shippingRequestRef.current) setIsFetchingRates(false);
      }
    },
    [items, pricesReady, freeShipping]
  );

  // Fetch rates when selected saved address changes
  useEffect(() => {
    if (!selectedAddressId) return;
    const addr = addresses.find((a) => a.id === selectedAddressId);
    if (addr?.postcode) fetchShip123Rates(addr);
  }, [selectedAddressId, addresses, fetchShip123Rates]);

  // Fetch rates when guest address is set
  useEffect(() => {
    if (guestAddress?.postcode) fetchShip123Rates(guestAddress);
  }, [guestAddress, fetchShip123Rates]);

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
    resetAddress({
      name: userProfile?.name || "",
      phone: userProfile?.phone || "",
      line1: "",
      line2: undefined,
      suburb: "",
      state: "",
      postcode: "",
      country: "AU",
    });
    setIsAddressDialogOpen(true);
  };

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    resetAddress({
      name: address.name || userProfile?.name || "",
      phone: address.phone || userProfile?.phone || "",
      line1: address.line1,
      line2: address.line2 || undefined,
      suburb: address.suburb,
      state: address.state,
      postcode: address.postcode,
      country: address.country || "AU",
    });
    setIsAddressDialogOpen(true);
  };

  const onAddressDialogSubmit = async (data: AddressInput) => {
    // Validate guest email before proceeding
    if (!isAuthenticated) {
      if (!guestEmail.trim()) {
        setGuestEmailError("Email address is required");
        toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
        return;
      }
      if (!isValidEmail(guestEmail)) {
        setGuestEmailError("Please enter a valid email address");
        toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
        return;
      }
    }

    setIsLoading(true);
    try {
      if (!isAuthenticated) {
        // Guest: just store locally, don't hit the DB
        setGuestAddress({ ...data, email: guestEmail.trim().toLowerCase() });
        setIsAddressDialogOpen(false);
        toast({ title: "Address saved", description: "Your delivery address has been set." });
        return;
      }
      if (editingAddress) {
        const result = await updateAddress(editingAddress.id, data);
        if (result.error) {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else if (result.address) {
          setAddresses(addresses.map((a) => (a.id === editingAddress.id ? result.address : a)));
          toast({ title: "Address updated", description: "Your address has been saved." });
          setIsAddressDialogOpen(false);
        }
      } else {
        const result = await createAddress(data);
        if (result.error) {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else if (result.address) {
          setAddresses([result.address, ...addresses]);
          setSelectedAddressId(result.address.id);
          toast({ title: "Address saved", description: "Your address has been added." });
          setIsAddressDialogOpen(false);
        }
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    setIsLoading(true);
    try {
      const result = await deleteAddress(id);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        const updated = addresses.filter((a) => a.id !== id);
        setAddresses(updated);
        if (selectedAddressId === id) {
          setSelectedAddressId(updated.length > 0 ? updated[0].id : null);
        }
        toast({ title: "Address deleted" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setDeleteConfirmId(null);
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
  // Place order — validate then request a PayWay single-use token
  const submitOrderWithToken = async (tokenId: string) => {
    if (couponNeedsRefresh || isApplyingCoupon) { setAwaitingToken(false); return; }
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
          shippingRateCode: selectedRateCode ?? undefined,
          shippingCost: shippingCost ?? 0,
          shippingQuoteToken: selectedRate?.quoteToken,
          couponCode: appliedCoupon?.code || undefined,
          addMembership: !isMember && addMembership,
          // REL-5: send the same key on every retry for this attempt
          idempotencyKey: idempotencyKeyRef.current ?? undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.retryWithNewKey || [400, 401, 402, 422].includes(response.status)) {
          idempotencyKeyRef.current = null;
        }
        const msg = data.error || "Payment failed. Please try again.";
        setPaymentError(msg);
        setSingleUseTokenId(null); // token was consumed — user must re-enter card
        toast({ title: response.status === 503 ? "Checkout Unavailable" : "Payment Failed", description: msg, variant: "destructive" });
        submissionInFlightRef.current = false; // allow retry
        setIsProcessing(false);
        return;
      }
      if (data.status === "success" || data.status === "pending") {
        // REL-3 fix: Only clear the cart when payment is confirmed (success).
        // For a "pending" async payment the cart must survive — if the PayWay
        // transaction ultimately fails, the customer still has their cart intact
        // and can retry without rebuilding it from scratch. The cart is cleared
        // by <ClearCartOnSuccess> on the confirmation page once the order is PAID.
        if (data.status === "success") {
          clearCart();
        }
        const confirmUrl = isAuthenticated
          ? `/order-confirmation/${data.orderId}`
          : `/order-confirmation/${data.orderId}?token=${encodeURIComponent(data.guestToken ?? "")}`;
        router.push(confirmUrl);
      } else if (data.status === "redirect" && data.checkoutUrl) {
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
    if (!paymentAvailable) return;
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
    if (!freeShipping && !selectedRateCode) {
      toast({ title: "Select a shipping option", description: "Please choose a shipping service.", variant: "destructive" });
      return;
    }
    setPaymentError(null);
    setSingleUseTokenId(null);
    submissionInFlightRef.current = false; // reset guard for this new attempt
    idempotencyKeyRef.current ??= crypto.randomUUID(); // retain across ambiguous network failures
    if (usesOnlinePay) {
      submissionInFlightRef.current = true;
      submitOrderWithToken("");
      return;
    }
    setAwaitingToken(true);
    triggerPayWayGetToken();
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
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      {/* Main Content */}
      <div className="space-y-6">
        {/* Order Items */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            Items ({itemCount})
          </h2>
          <div className="mt-4 divide-y divide-border">
            {items.map((item, index) => {
              const memberPrice = getMemberPrice(item);
              const basePrice = Math.max(0, item.product.price ?? 0);
              const effectivePrice = effectiveMember && memberPrice && memberPrice > 0 ? memberPrice : basePrice;
              const hasMemberDiscount = effectiveMember && memberPrice && memberPrice > 0 && memberPrice < basePrice;
              const itemKey = `${item.product.id ?? 'unknown'}-${item.product.variantId ?? 'default'}-${index}`;
              return (
                <div key={itemKey} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <Link href={`/products/${item.product.slug}`} className="relative h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0 block hover:opacity-80 transition-opacity">
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
                    <Link href={`/products/${item.product.slug}`} className="text-sm font-medium text-foreground truncate hover:text-primary transition-colors block">{item.product.name}</Link>
                    {item.product.variantLabel && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.product.variantLabel}</p>
                    )}
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

        {/* Shipping Address */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Shipping Address
          </h2>

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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{guestAddress.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {guestAddress.line1}{guestAddress.line2 ? `, ${guestAddress.line2}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{guestAddress.suburb}, {guestAddress.state} {guestAddress.postcode}</p>
                        <p className="text-xs text-muted-foreground">{guestAddress.phone}</p>
                        {guestAddress.email && <p className="text-xs text-muted-foreground">{guestAddress.email}</p>}
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
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {appliedCoupon.code} &mdash; {appliedCoupon.discountType === "PERCENTAGE" ? appliedCoupon.discountValue + "%" : "$" + appliedCoupon.discountValue} off
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={removeCoupon} className="text-xs h-7">
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Enter code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isApplyingCoupon && applyCoupon()}
                disabled={isApplyingCoupon}
                className="h-10 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => applyCoupon()}
                disabled={!couponCode.trim() || isApplyingCoupon}
                className="h-10 px-5 min-w-[80px]"
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

      {/* Order Summary Sidebar */}
      <aside className="lg:sticky lg:top-24 space-y-6">
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
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium">
                {freeShipping ? (
                  <span className="text-green-600">Free</span>
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
              <span className="text-muted-foreground">GST (10%)</span>
              <span className="font-medium">{currencyFormatter.format(gst)}</span>
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
                {freeShipping || shippingCost !== null
                  ? currencyFormatter.format(total)
                  : "—"}
              </span>
            </div>
          </div>

          {freeShipping && (
            <p className="mt-3 text-xs text-green-600 font-medium flex items-center gap-1">
              {effectiveMember ? "Free shipping included with your membership" : "Free shipping on orders of $1,200 or more"}
            </p>
          )}

          {/* Ship123 shipping options */}
          {!freeShipping && (
            <div className="mt-4">
              {isFetchingRates && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Fetching shipping rates…
                </div>
              )}
              {ratesError && !isFetchingRates && (
                <p className="text-xs text-destructive py-1">{ratesError}</p>
              )}
              {!isFetchingRates && shippingRates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    Shipping Options
                  </p>
                  {shippingRates.map((rate) => (
                    <button
                      key={rate.serviceCode}
                      type="button"
                      onClick={() => setSelectedRateCode(rate.serviceCode)}
                      className={cn(
                        "w-full flex items-start justify-between rounded-lg border px-3 py-2.5 text-left text-xs transition-all",
                        selectedRateCode === rate.serviceCode
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-muted-foreground/40"
                      )}
                    >
                      <span className="flex items-start gap-2">
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">{rate.serviceName}</span>
                          {rate.deliveryTime && (
                            <span className="text-[10px] text-muted-foreground leading-snug">
                              {rate.deliveryTime}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="font-semibold text-foreground shrink-0 ml-2 mt-0.5">
                        {currencyFormatter.format(rate.price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Membership Add-on Card (BookMyShow style) ── */}
          {isAuthenticated && !isMember && (
            <div className={cn(
              "mt-4 rounded-xl border-2 transition-all duration-200 overflow-hidden",
              addMembership ? "border-primary bg-primary/5" : "border-border bg-secondary/50"
            )}>
              {/* Toggle header */}
              <button
                type="button"
                onClick={() => setAddMembership(!addMembership)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <div className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                    addMembership ? "border-primary bg-primary" : "border-muted-foreground/40 bg-white"
                  )}>
                    {addMembership && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <Crown className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-bold text-foreground">
                        {hasExpiredMembership ? "Renew CHS Membership" : "Add CHS Membership"}
                      </span>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">+{currencyFormatter.format(MEMBERSHIP_PRICE)}</span>
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
                      { Icon: BadgePercent, text: "Up to 30% off every order" },
                      { Icon: Truck,        text: "Free express delivery over $200" },
                      { Icon: ShieldCheck,  text: "3-year extended warranty" },
                      { Icon: Zap,          text: "Early access to sales & new arrivals" },
                    ].map(({ Icon, text }) => (
                      <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="h-3 w-3 text-primary shrink-0" />
                        {text}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">{activePlan ? `${activePlan.name} · activates immediately on payment` : "Annual membership · activates immediately on payment"}</p>
                </div>
              )}

              {/* Active confirmation strip */}
              {addMembership && (
                <div className="px-4 py-2 bg-primary/10 border-t border-primary/20 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="text-xs font-semibold text-primary">Membership added — activates after payment</p>
                </div>
              )}
            </div>
          )}

          {/* PayWay is retained until OnlinePay is enabled through the gateway switch. */}
          {paymentAvailable && !usesOnlinePay && <div className="mt-4">
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
                setPaymentError(msg);
                setAwaitingToken(false);
                setIsProcessing(false);
              }}
              disabled={isProcessing}
            />
            {paymentError && (
              <p className="mt-2 text-xs text-destructive font-medium">{paymentError}</p>
            )}
          </div>}

          {!paymentAvailable && <p role="alert" className="mt-4 text-sm text-destructive">Payment checkout is temporarily unavailable. Please try again later.</p>}
          {usesOnlinePay && paymentError && <p role="alert" className="mt-2 text-sm text-destructive">{paymentError}</p>}
          {pricesError && <p role="alert" className="mt-2 text-sm text-destructive">{pricesError}</p>}
          {unavailable && <p role="alert" className="mt-2 text-sm text-destructive">An item is unavailable or exceeds stock. Update your cart before paying.</p>}
          {shippingAvailable === false && <p role="alert" className="mt-2 text-sm text-destructive">Shipping is unavailable until a supported courier is enabled. Please contact support.</p>}
          {/* Place Order Button */}
          <Button
            className="mt-5 w-full h-12 text-sm font-semibold"
            onClick={handlePlaceOrder}
            disabled={!paymentAvailable || shippingAvailable !== true || !pricesReady || unavailable || couponNeedsRefresh || isApplyingCoupon || isProcessing || awaitingToken || items.length === 0 || (!freeShipping && shippingCost === null)}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                {addMembership && !isMember
                  ? `Pay ${freeShipping || shippingCost !== null ? currencyFormatter.format(total) : "—"} & Join`
                  : "Place Order & Pay"}
              </>
            )}
          </Button>

          {paymentAvailable && <p className="mt-3 text-center text-[11px] text-muted-foreground leading-relaxed">
            Your payment is processed securely by {usesOnlinePay ? "Westpac OnlinePay" : "PayWay (Westpac)"}. Card details never touch our servers.
          </p>}

          {/* Trust badges */}
          <div className="mt-5 flex items-center justify-center gap-4 border-t border-border pt-4">
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

      {/* Add / Edit Address Dialog */}
      <Dialog open={isAddressDialogOpen} onOpenChange={(open) => {
        // Block close for guests who haven't entered an address yet —
        // they must fill the form first. The Cancel button below is
        // always available for authenticated users.
        if (!open && !isAuthenticated && !guestAddress) return;
        if (!open) {
          setEditingAddress(null);
          setIsLoading(false); // clear any stuck loading state
        }
        setIsAddressDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-lg max-h-[calc(100%-2rem)] overflow-y-auto" hideCloseButton={!isAuthenticated && !guestAddress}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {editingAddress ? "Edit Address" : "Add Delivery Address"}
            </DialogTitle>
            <DialogDescription>
              {editingAddress ? "Update your delivery address details" : "Enter your delivery address details"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddressSubmit(onAddressDialogSubmit)} className="space-y-4 pt-2">
            {/* Email — guests only */}
            {!isAuthenticated && (
              <div className="space-y-2">
                <Label htmlFor="dlg-email" className="text-sm font-medium">Email Address <span className="text-destructive">*</span></Label>
                <Input
                  id="dlg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={guestEmail}
                  onChange={(e) => {
                    const value = e.target.value;
                    setGuestEmail(value);
                    if (value && !isValidEmail(value)) {
                      setGuestEmailError("Please enter a valid email address");
                    } else {
                      setGuestEmailError(null);
                    }
                  }}
                  onBlur={() => {
                    if (guestEmail && !isValidEmail(guestEmail)) {
                      setGuestEmailError("Please enter a valid email address");
                    }
                  }}
                  required
                  aria-invalid={!!guestEmailError}
                  aria-describedby={guestEmailError ? "email-error" : undefined}
                  className={guestEmailError ? "border-destructive" : ""}
                />
                {guestEmailError && (
                  <p id="email-error" className="text-sm text-destructive">{guestEmailError}</p>
                )}
              </div>
            )}

            {/* Name & Phone */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dlg-name" className="text-sm font-medium">Full Name</Label>
                <Input aria-invalid={!!addressErrors.name} aria-describedby={addressErrors.name ? "dlg-name-error" : undefined} id="dlg-name" placeholder="John Smith" {...registerAddress("name")} />
                {addressErrors.name && <p id="dlg-name-error" role="alert" className="text-sm text-destructive">{addressErrors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dlg-phone" className="text-sm font-medium">Phone</Label>
                <Input aria-invalid={!!addressErrors.phone} aria-describedby={addressErrors.phone ? "dlg-phone-error" : undefined} id="dlg-phone" type="tel" placeholder="0412 345 678" {...registerAddress("phone")} />
                {addressErrors.phone && <p id="dlg-phone-error" role="alert" className="text-sm text-destructive">{addressErrors.phone.message}</p>}
              </div>
            </div>

            {/* Street Address with Google Autocomplete */}
            <AddressAutocomplete
              value={watchAddress("line1")}
              onChange={(val) => setAddressValue("line1", val)}
              onAddressSelect={(addr) => {
                setAddressValue("line1", addr.line1);
                if (addr.line2) setAddressValue("line2", addr.line2);
                setAddressValue("suburb", addr.suburb);
                setAddressValue("state", addr.state);
                setAddressValue("postcode", addr.postcode);
                setAddressValue("country", addr.country);
              }}
              error={addressErrors.line1?.message}
              disabled={isLoading}
            />

            {/* Apt / Unit */}
            <div className="space-y-2">
              <Label htmlFor="dlg-line2" className="text-sm font-medium flex flex-wrap items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Apartment, Suite, Unit <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input id="dlg-line2" placeholder="Apt 4B, Floor 2" {...registerAddress("line2")} />
            </div>

            {/* Suburb Selector */}
            <SuburbSelector
              value={watchAddress("suburb")}
              onChange={(val) => setAddressValue("suburb", val)}
              state={addressState}
              error={addressErrors.suburb?.message}
              disabled={isLoading}
            />

            {/* State & Postcode */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dlg-state" className="text-sm font-medium flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  State
                </Label>
                <Select value={addressState} onValueChange={(v) => setAddressValue("state", v)}>
                  <SelectTrigger id="dlg-state" aria-invalid={!!addressErrors.state} aria-describedby={addressErrors.state ? "dlg-state-error" : undefined} className={cn(addressErrors.state && "border-destructive")}>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addressErrors.state && <p id="dlg-state-error" role="alert" className="text-sm text-destructive">{addressErrors.state.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dlg-postcode" className="text-sm font-medium">Postcode</Label>
                <Input aria-invalid={!!addressErrors.postcode} aria-describedby={addressErrors.postcode ? "dlg-postcode-error" : undefined} id="dlg-postcode" placeholder="2000" maxLength={4} {...registerAddress("postcode")} />
                {addressErrors.postcode && <p id="dlg-postcode-error" role="alert" className="text-sm text-destructive">{addressErrors.postcode.message}</p>}
              </div>
            </div>

            {/* Country (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="dlg-country" className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Country
              </Label>
              <Input id="dlg-country" value="Australia" disabled className="bg-muted/50" />
            </div>

            <DialogFooter className="gap-2 pt-2">
              {(isAuthenticated || !!guestAddress) && (
                <Button type="button" variant="outline" onClick={() => { setEditingAddress(null); setIsLoading(false); setIsAddressDialogOpen(false); }}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" />{editingAddress ? "Update Address" : "Save Address"}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Address
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteAddress(deleteConfirmId)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
