"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
} from "lucide-react";
import { Address } from "@prisma/client";
import { cn } from "@/lib/utils";
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
import Image from "next/image";
import { AddressAutocomplete } from "@/components/account/address-autocomplete";
import { SuburbSelector } from "@/components/account/suburb-selector";
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

// Shipping address form schema
const shippingFormSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  phone: z.string().min(1, "Phone number is required").max(20),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  line1: z.string().min(3, "Street address is required"),
  line2: z.string().optional(),
  suburb: z.string().min(2, "Suburb is required"),
  state: z.string().min(1, "State is required"),
  postcode: z.string().regex(/^\d{4}$/, "Enter a valid 4-digit postcode"),
});

type ShippingFormData = z.infer<typeof shippingFormSchema>;

interface CheckoutFormProps {
  readonly savedAddresses: Address[];
  readonly addressesError?: string;
  readonly isAuthenticated: boolean;
  readonly userProfile?: { name: string; phone: string };
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

// ---------- Extracted inline address form with Google Autocomplete ----------
interface NewAddressFormProps {
  isGuest: boolean;
  line1: string;
  suburb: string;
  state: string;
  errors: Partial<Record<keyof ShippingFormData, { message?: string }>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: (...args: any[]) => any;
  setShippingValue: (field: keyof ShippingFormData, value: string) => void;
}

function NewAddressForm({ isGuest, line1, suburb, state, errors, register, setShippingValue }: NewAddressFormProps) {
  return (
    <div className="space-y-4">
      {/* Email — guests only */}
      {isGuest && (
        <div>
          <Label htmlFor="ship-email" className="text-xs font-medium">
            Email Address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ship-email"
            type="email"
            placeholder="you@example.com"
            className={cn("mt-1.5 h-10", errors.email && "border-destructive")}
            {...register("email")}
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>
      )}

      {/* Name & Phone */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ship-name" className="text-xs font-medium">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ship-name"
            placeholder="John Smith"
            className={cn("mt-1.5 h-10", errors.name && "border-destructive")}
            {...register("name")}
          />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="ship-phone" className="text-xs font-medium">
            Phone <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ship-phone"
            type="tel"
            placeholder="0412 345 678"
            className={cn("mt-1.5 h-10", errors.phone && "border-destructive")}
            {...register("phone")}
          />
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
        </div>
      </div>

      {/* Street Address with Google Autocomplete */}
      <AddressAutocomplete
        value={line1}
        onChange={(val) => setShippingValue("line1", val)}
        onAddressSelect={(addr) => {
          setShippingValue("line1", addr.line1);
          if (addr.line2) setShippingValue("line2", addr.line2);
          setShippingValue("suburb", addr.suburb);
          setShippingValue("state", addr.state);
          setShippingValue("postcode", addr.postcode);
        }}
        error={errors.line1?.message}
      />

      {/* Unit / Apt */}
      <div>
        <Label htmlFor="ship-line2" className="text-xs font-medium flex items-center gap-1.5">
          <Building className="h-3.5 w-3.5 text-muted-foreground" />
          Apt, Suite, Unit <span className="text-muted-foreground">(Optional)</span>
        </Label>
        <Input id="ship-line2" placeholder="Unit 4" className="mt-1.5 h-10" {...register("line2")} />
      </div>

      {/* Suburb */}
      <SuburbSelector
        value={suburb}
        onChange={(val) => setShippingValue("suburb", val)}
        state={state}
        error={errors.suburb?.message}
      />

      {/* State & Postcode */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-medium">State <span className="text-destructive">*</span></Label>
          <Select value={state} onValueChange={(v) => setShippingValue("state", v)}>
            <SelectTrigger className={cn("mt-1.5 h-10", errors.state && "border-destructive")}>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {AU_STATES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.state && <p className="mt-1 text-xs text-destructive">{errors.state.message}</p>}
        </div>
        <div>
          <Label htmlFor="ship-postcode" className="text-xs font-medium">
            Postcode <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ship-postcode"
            placeholder="2000"
            maxLength={4}
            className={cn("mt-1.5 h-10", errors.postcode && "border-destructive")}
            {...register("postcode")}
          />
          {errors.postcode && <p className="mt-1 text-xs text-destructive">{errors.postcode.message}</p>}
        </div>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------

export function CheckoutForm({ savedAddresses, addressesError: _addressesError, isAuthenticated, userProfile }: CheckoutFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);

  // Address management state
  const [addresses, setAddresses] = useState<Address[]>(savedAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    savedAddresses.length > 0 ? savedAddresses[0].id : null
  );
  // "saved" | "new" — guests always start on "new"
  const [addressMode, setAddressMode] = useState<"saved" | "new">(
    savedAddresses.length === 0 ? "new" : "saved"
  );
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Cart state
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  // Calculate totals
  const discount = appliedCoupon ? subtotal * (appliedCoupon.discount / 100) : 0;
  const shippingCost = subtotal - discount >= 1200 ? 0 : 79;
  const total = subtotal - discount + shippingCost;

  // Inline new-address form
  const {
    register: registerShipping,
    handleSubmit: handleShippingSubmit,
    setValue: setShippingValue,
    formState: { errors: shippingErrors },
    watch: watchShipping,
    reset: resetShipping,
  } = useForm<ShippingFormData>({
    resolver: zodResolver(shippingFormSchema),
    defaultValues: {
      name: userProfile?.name || "",
      phone: userProfile?.phone || "",
      email: "",
      line1: "",
      line2: "",
      suburb: "",
      state: "",
      postcode: "",
    },
  });

  const shippingLine1 = watchShipping("line1");
  const shippingState = watchShipping("state");
  const shippingSuburb = watchShipping("suburb");

  // Address dialog form (for saving to account)
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
  const switchToNewAddress = () => {
    resetShipping({
      name: userProfile?.name || "",
      phone: userProfile?.phone || "",
      email: "",
      line1: "",
      line2: "",
      suburb: "",
      state: "",
      postcode: "",
    });
    setAddressMode("new");
  };

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
    setIsLoading(true);
    try {
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
          setAddressMode("saved");
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
          if (updated.length > 0) {
            setSelectedAddressId(updated[0].id);
            setAddressMode("saved");
          } else {
            setSelectedAddressId(null);
            setAddressMode("new");
          }
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

  const applyCoupon = () => {
    if (!couponCode.trim()) return;
    if (couponCode.toUpperCase() === "SAVE10") {
      setAppliedCoupon({ code: couponCode.toUpperCase(), discount: 10 });
      toast({ title: "Coupon Applied", description: "10% discount applied." });
    } else {
      toast({ title: "Invalid Coupon", description: "The coupon code is not valid.", variant: "destructive" });
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  // Place order with Stripe Checkout redirect
  const placeOrder = async (shippingData?: ShippingFormData) => {
    if (items.length === 0) {
      toast({ title: "Cart is empty", description: "Add items to your cart first.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // Validate address mode
      if (addressMode === "saved" && !selectedAddressId) {
        toast({ title: "Error", description: "Please select a shipping address.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
      if (addressMode === "new" && !shippingData) {
        toast({ title: "Error", description: "Please fill in your shipping address.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      // Build new address payload (only used when addressMode === "new")
      const addressPayload = addressMode === "new" && shippingData ? {
        name: shippingData.name,
        phone: shippingData.phone,
        line1: shippingData.line1,
        line2: shippingData.line2 || undefined,
        suburb: shippingData.suburb,
        state: shippingData.state,
        postcode: shippingData.postcode,
        country: "AU",
      } : undefined;

      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.product.id,
            variantId: item.product.variantId || undefined,
            quantity: item.quantity,
          })),
          // When using saved address, only send the ID — no address object
          ...(addressMode === "saved"
            ? { savedAddressId: selectedAddressId }
            : { address: addressPayload }),
          guestEmail: !isAuthenticated ? shippingData?.email : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Checkout Error",
          description: data.error || "Failed to create checkout session.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Clear cart before redirect
      clearCart();

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Error", description: "No checkout URL returned.", variant: "destructive" });
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handlePlaceOrder = () => {
    if (addressMode === "new") {
      handleShippingSubmit((data) => placeOrder(data))();
    } else {
      placeOrder();
    }
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
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            Items ({itemCount})
          </h2>
          <div className="mt-4 divide-y divide-border">
            {items.map((item) => (
              <div key={`${item.product.id}-${item.product.variantId}`} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0">
                  {item.product.images?.[0] && (
                    <Image
                      src={item.product.images[0]}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground truncate">{item.product.name}</h3>
                  {item.product.variantLabel && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.product.variantLabel}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-foreground shrink-0">
                  {currencyFormatter.format(item.product.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Shipping Address */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Shipping Address
          </h2>

          {/* Saved address cards — authenticated with existing addresses */}
          {isAuthenticated && addresses.length > 0 && (
            <div className="mt-4 space-y-2">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all",
                    addressMode === "saved" && selectedAddressId === address.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                  onClick={() => {
                    setSelectedAddressId(address.id);
                    setAddressMode("saved");
                  }}
                >
                  {/* Radio indicator */}
                  <div className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    addressMode === "saved" && selectedAddressId === address.id
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  )}>
                    {addressMode === "saved" && selectedAddressId === address.id && (
                      <Check className="h-2.5 w-2.5 text-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{address.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {address.line1}{address.line2 ? `, ${address.line2}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {address.suburb}, {address.state} {address.postcode}
                    </p>
                    <p className="text-xs text-muted-foreground">{address.phone}</p>
                  </div>

                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => openEditDialog(address)}
                      className="h-7 w-7 p-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => setDeleteConfirmId(address.id)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add new address option — toggles inline form */}
              {addressMode === "saved" ? (
                <button
                  type="button"
                  onClick={switchToNewAddress}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  Add a new address
                </button>
              ) : (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-foreground">New address</p>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => {
                        setAddressMode("saved");
                        setSelectedAddressId(addresses[0]?.id ?? null);
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                  <NewAddressForm
                    isGuest={false}
                    line1={shippingLine1}
                    suburb={shippingSuburb}
                    state={shippingState}
                    errors={shippingErrors}
                    register={registerShipping}
                    setShippingValue={setShippingValue}
                  />
                </div>
              )}
            </div>
          )}

          {/* Guest or no saved addresses — always show form */}
          {(!isAuthenticated || addresses.length === 0) && (
            <div className="mt-5">
              <NewAddressForm
                isGuest={!isAuthenticated}
                line1={shippingLine1}
                suburb={shippingSuburb}
                state={shippingState}
                errors={shippingErrors}
                register={registerShipping}
                setShippingValue={setShippingValue}
              />
            </div>
          )}
        </section>

        {/* Coupon Code */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground mb-4">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Promo Code
          </h2>

          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {appliedCoupon.code} &mdash; {appliedCoupon.discount}% off
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
                onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                className="h-10 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={applyCoupon}
                disabled={!couponCode.trim()}
                className="h-10 px-5"
              >
                Apply
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Order Summary Sidebar */}
      <aside className="lg:sticky lg:top-24 space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">Order Summary</h2>

          <div className="mt-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{currencyFormatter.format(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Discount ({appliedCoupon?.code})</span>
                <span className="font-medium text-green-600">-{currencyFormatter.format(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium">
                {shippingCost === 0 ? (
                  <span className="text-green-600">Free</span>
                ) : (
                  currencyFormatter.format(shippingCost)
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST (10%)</span>
              <span className="font-medium">{currencyFormatter.format(subtotal * 0.1)}</span>
            </div>

            <Separator className="my-3" />

            <div className="flex justify-between items-center">
              <span className="text-base font-bold">Total</span>
              <span className="text-xl font-black">
                {currencyFormatter.format(total + subtotal * 0.1)}
              </span>
            </div>
          </div>

          {shippingCost === 0 && (
            <p className="mt-3 text-xs text-green-600 font-medium">
              Free shipping on orders over $1,200
            </p>
          )}

          {/* Place Order Button */}
          <Button
            className="mt-6 w-full h-12 text-sm font-semibold"
            onClick={handlePlaceOrder}
            disabled={isProcessing || items.length === 0}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Place Order &amp; Pay
              </>
            )}
          </Button>

          <p className="mt-3 text-center text-[11px] text-muted-foreground leading-relaxed">
            You&apos;ll be redirected to Stripe&apos;s secure checkout to complete payment.
          </p>

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

      {/* Edit Address Dialog (for saved addresses only) */}
      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {editingAddress ? "Edit Address" : "Save New Address"}
            </DialogTitle>
            <DialogDescription>
              {editingAddress ? "Update your saved address." : "Save this address to your account for future orders."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddressSubmit(onAddressDialogSubmit)} className="space-y-4 mt-2">
            {/* Name & Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium">Full Name</Label>
                <Input
                  placeholder="John Smith"
                  className={cn("mt-1.5 h-10", addressErrors.name && "border-destructive")}
                  {...registerAddress("name")}
                />
                {addressErrors.name && <p className="mt-1 text-xs text-destructive">{addressErrors.name.message}</p>}
              </div>
              <div>
                <Label className="text-xs font-medium">Phone</Label>
                <Input
                  type="tel"
                  placeholder="0412 345 678"
                  className={cn("mt-1.5 h-10", addressErrors.phone && "border-destructive")}
                  {...registerAddress("phone")}
                />
                {addressErrors.phone && <p className="mt-1 text-xs text-destructive">{addressErrors.phone.message}</p>}
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
            <div>
              <Label className="text-xs font-medium flex items-center gap-2">
                <Building className="h-3.5 w-3.5 text-muted-foreground" />
                Apt, Suite, Unit <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input placeholder="Unit 4" className="mt-1.5 h-10" {...registerAddress("line2")} />
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
              <div>
                <Label className="text-xs font-medium">State</Label>
                <Select value={addressState} onValueChange={(v) => setAddressValue("state", v)}>
                  <SelectTrigger className={cn("mt-1.5 h-10", addressErrors.state && "border-destructive")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addressErrors.state && <p className="mt-1 text-xs text-destructive">{addressErrors.state.message}</p>}
              </div>
              <div>
                <Label className="text-xs font-medium">Postcode</Label>
                <Input
                  placeholder="2000" maxLength={4}
                  className={cn("mt-1.5 h-10", addressErrors.postcode && "border-destructive")}
                  {...registerAddress("postcode")}
                />
                {addressErrors.postcode && <p className="mt-1 text-xs text-destructive">{addressErrors.postcode.message}</p>}
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddressDialogOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : editingAddress ? "Save Changes" : "Save Address"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Delete Address</DialogTitle>
            <DialogDescription>
              Are you sure? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteAddress(deleteConfirmId)}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
