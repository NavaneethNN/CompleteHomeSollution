"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { 
  MapPin, 
  Plus, 
  Home, 
  Pencil, 
  Trash2, 
  AlertCircle, 
  Tag,
  ShoppingBag,
  Loader2,
  Check
} from "lucide-react";
import { Address } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
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
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Australian states
const AU_STATES = [
  { value: "NSW", label: "New South Wales" },
  { value: "VIC", label: "Victoria" },
  { value: "QLD", label: "Queensland" },
  { value: "WA", label: "Western Australia" },
  { value: "SA", label: "South Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "ACT", label: "Australian Capital Territory" },
  { value: "NT", label: "Northern Territory" },
];

// Stripe setup
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface CheckoutFormProps {
  readonly savedAddresses: Address[];
  readonly addressesError?: string;
  readonly isAuthenticated: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

// Stripe Card Form Component
function StripePaymentForm({ 
  total, 
  isProcessing, 
  setIsProcessing, 
  onSuccess,
  disabled
}: { 
  total: number; 
  isProcessing: boolean; 
  setIsProcessing: (v: boolean) => void;
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || disabled) return;

    setIsProcessing(true);

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: elements.getElement(CardElement)!,
    });

    if (error) {
      toast({
        title: "Payment Error",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    // Simulate successful payment
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Payment Successful",
      description: "Your order has been placed!",
      variant: "success",
    });
    
    onSuccess();
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg bg-white">
        <CardElement 
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#424770",
                "::placeholder": { color: "#aab7c4" },
              },
              invalid: { color: "#9e2146" },
            },
          }}
        />
      </div>
      <Button 
        type="submit" 
        className="w-full" 
        disabled={!stripe || isProcessing || disabled}
      >
        {isProcessing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
        ) : (
          `Pay ${currencyFormatter.format(total)}`
        )}
      </Button>
    </form>
  );
}

export function CheckoutForm({ savedAddresses, addressesError, isAuthenticated }: CheckoutFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  
  // Address management state
  const [addresses, setAddresses] = useState<Address[]>(savedAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
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
  
  // Address form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors: addressErrors },
    watch,
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      name: "",
      phone: "",
      line1: "",
      line2: undefined,
      suburb: "",
      state: "",
      postcode: "",
      country: "AU",
    },
  });

  const selectedState = watch("state");

  // Address management functions
  const openAddDialog = () => {
    setEditingAddress(null);
    reset({
      name: "",
      phone: "",
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
    reset({
      name: (address as any).name || "",
      phone: (address as any).phone || "",
      line1: address.line1,
      line2: address.line2 || undefined,
      suburb: address.suburb,
      state: address.state,
      postcode: address.postcode,
      country: address.country || "AU",
    });
    setIsAddressDialogOpen(true);
  };

  const onAddressSubmit = async (data: AddressInput) => {
    setIsLoading(true);
    try {
      if (editingAddress) {
        const result = await updateAddress(editingAddress.id, data);
        if (result.error) {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else if (result.address) {
          setAddresses(addresses.map((a) => (a.id === editingAddress.id ? result.address : a)));
          toast({ title: "Success", description: "Address updated.", variant: "success" });
          setIsAddressDialogOpen(false);
        }
      } else {
        const result = await createAddress(data);
        if (result.error) {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else if (result.address) {
          setAddresses([result.address, ...addresses]);
          toast({ title: "Success", description: "Address added.", variant: "success" });
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
        setAddresses(addresses.filter((a) => a.id !== id));
        if (selectedAddressId === id) setSelectedAddressId(null);
        toast({ title: "Success", description: "Address deleted.", variant: "success" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setDeleteConfirmId(null);
    }
  };

  const formatAddress = (address: Address) => {
    const parts = [
      address.line1,
      address.line2,
      `${address.suburb}, ${address.state} ${address.postcode}`,
      address.country,
    ].filter(Boolean);
    return parts;
  };

  const selectAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
  };

  const applyCoupon = () => {
    if (!couponCode.trim()) return;
    if (couponCode.toUpperCase() === "SAVE10") {
      setAppliedCoupon({ code: couponCode.toUpperCase(), discount: 10 });
      toast({ title: "Coupon Applied", description: "10% discount applied.", variant: "success" });
    } else {
      toast({ title: "Invalid Coupon", description: "The coupon code is not valid.", variant: "destructive" });
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const onPaymentSuccess = () => {
    clearCart();
    router.push("/order-confirmation");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      {/* Main Form - Single Page Checkout */}
      <div className="space-y-6">
        {/* Order Items */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Order Items ({itemCount})
          </h2>
          <div className="mt-4 space-y-4">
            {items.map((item) => (
              <div key={`${item.product.id}-${item.product.variantId}`} className="flex gap-4 py-4 border-b border-border last:border-0">
                <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
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
                  <h3 className="font-medium text-foreground truncate">{item.product.name}</h3>
                  {item.product.variantLabel && (
                    <p className="text-sm text-muted-foreground">{item.product.variantLabel}</p>
                  )}
                  {item.product.sku && (
                    <p className="text-xs text-muted-foreground">SKU: {item.product.sku}</p>
                  )}
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    <p className="font-medium">{currencyFormatter.format(item.product.price * item.quantity)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Address */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Shipping Address
            </h2>
            {isAuthenticated && (
              <Button type="button" variant="ghost" size="sm" onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Add New
              </Button>
            )}
          </div>

          {/* Error Display */}
          {isAuthenticated && addressesError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{addressesError}</p>
            </div>
          )}

          {/* Saved Addresses */}
          {isAuthenticated && addresses.length > 0 && (
            <div className="space-y-3 mb-6">
              {addresses.map((address) => (
                <Card
                  key={address.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedAddressId === address.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/50"
                  )}
                  onClick={() => selectAddress(address.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Home className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="space-y-0.5">
                          {formatAddress(address).map((line, i) => (
                            <p key={i} className={`text-sm ${i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(address);
                          }}
                          className="h-7 w-7 p-0"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(address.id);
                          }}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {selectedAddressId === address.id && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No Address Selected Warning */}
          {!selectedAddressId && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <p className="text-sm text-amber-800">
                Please select a saved address or add a new one to continue.
              </p>
            </div>
          )}
        </div>

        {/* Coupon Code */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
            <Tag className="h-5 w-5" />
            Coupon Code
          </h2>
          
          {appliedCoupon ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {appliedCoupon.code} - {appliedCoupon.discount}% off
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={removeCoupon}>
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1"
              />
              <Button type="button" onClick={applyCoupon} disabled={!couponCode.trim()}>
                Apply
              </Button>
            </div>
          )}
        </div>

        {/* Payment Section */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-4">Payment</h2>
          <Elements stripe={stripePromise}>
            <StripePaymentForm
              total={total}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              onSuccess={onPaymentSuccess}
              disabled={!selectedAddressId}
            />
          </Elements>
          {!selectedAddressId && (
            <p className="mt-2 text-xs text-amber-600 text-center">
              Please select a shipping address to complete payment
            </p>
          )}
        </div>
      </div>

      {/* Order Summary Sidebar */}
      <aside className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
        <div className="border-b border-border pb-4">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Order Summary</p>
          <h2 className="mt-2 text-2xl font-black text-foreground">Your Order</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </div>

        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{currencyFormatter.format(subtotal)}</span>
          </div>
          
          {discount > 0 && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-green-600">Discount ({appliedCoupon?.code})</span>
              <span className="font-medium text-green-600">-{currencyFormatter.format(discount)}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span className="font-medium">
              {shippingCost === 0 ? "Free" : currencyFormatter.format(shippingCost)}
            </span>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-bold">Total</span>
            <span className="text-xl font-black">{currencyFormatter.format(total)}</span>
          </div>
        </div>

        <div className="mt-6 space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Secure SSL Encryption</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>PCI DSS Compliant</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By placing this order, you agree to our Terms of Service and Privacy Policy.
        </p>
      </aside>

      {/* Address Dialog */}
      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
        <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "Edit Address" : "Add New Address"}
            </DialogTitle>
            <DialogDescription>
              {editingAddress ? "Update your address details below." : "Enter your address details below."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onAddressSubmit)} className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    className={cn("mt-1.5", addressErrors.name && "border-destructive")}
                    {...register("name")}
                  />
                  {addressErrors.name && (
                    <p className="mt-1 text-xs text-destructive">{addressErrors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Mobile Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0412 345 678"
                    className={cn("mt-1.5", addressErrors.phone && "border-destructive")}
                    {...register("phone")}
                  />
                  {addressErrors.phone && (
                    <p className="mt-1 text-xs text-destructive">{addressErrors.phone.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="line1">Street Address</Label>
                <Input
                  id="line1"
                  placeholder="123 Main Street"
                  className={cn("mt-1.5", addressErrors.line1 && "border-destructive")}
                  {...register("line1")}
                />
                {addressErrors.line1 && (
                  <p className="mt-1 text-xs text-destructive">{addressErrors.line1.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="line2">
                  Apartment, Suite, etc. <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="line2"
                  placeholder="Unit 4"
                  className="mt-1.5"
                  {...register("line2")}
                />
              </div>

              <div>
                <Label htmlFor="suburb">Suburb</Label>
                <Input
                  id="suburb"
                  placeholder="Sydney"
                  className={cn("mt-1.5", addressErrors.suburb && "border-destructive")}
                  {...register("suburb")}
                />
                {addressErrors.suburb && (
                  <p className="mt-1 text-xs text-destructive">{addressErrors.suburb.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={selectedState}
                    onValueChange={(value) => setValue("state", value)}
                  >
                    <SelectTrigger className={cn("mt-1.5", addressErrors.state && "border-destructive")}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {AU_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {addressErrors.state && (
                    <p className="mt-1 text-xs text-destructive">{addressErrors.state.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    placeholder="2000"
                    maxLength={4}
                    className={cn("mt-1.5", addressErrors.postcode && "border-destructive")}
                    {...register("postcode")}
                  />
                  {addressErrors.postcode && (
                    <p className="mt-1 text-xs text-destructive">{addressErrors.postcode.message}</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddressDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : editingAddress ? "Save Changes" : "Add Address"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Address</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isLoading}
            >
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
