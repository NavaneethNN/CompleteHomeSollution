"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Truck, CreditCard, MapPin, ChevronRight, Loader2 } from "lucide-react";
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

// Australian postcode validation regex (4 digits)
const postcodeRegex = /^[0-9]{4}$/;

// Email validation regex
const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Phone validation (Australian format)
const phoneRegex = /^(\+61|0)[2-478][0-9]{8}$/;

// Schema for shipping address
const shippingSchema = z.object({
  email: z.string().regex(emailRegex, "Please enter a valid email address"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  phone: z.string().regex(phoneRegex, "Please enter a valid Australian phone number"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  apartment: z.string().optional(),
  suburb: z.string().min(2, "Suburb must be at least 2 characters"),
  state: z.string().min(1, "Please select a state"),
  postcode: z.string().regex(postcodeRegex, "Postcode must be 4 digits"),
});

type ShippingFormData = z.infer<typeof shippingSchema>;

// Shipping methods
const SHIPPING_METHODS = [
  {
    id: "standard",
    name: "Standard Delivery",
    description: "5-7 business days",
    price: 79,
    icon: Truck,
  },
  {
    id: "express",
    name: "Express Delivery",
    description: "2-3 business days",
    price: 129,
    icon: Truck,
  },
  {
    id: "free",
    name: "Free Delivery",
    description: "Orders over $1,200 - 5-7 business days",
    price: 0,
    icon: Truck,
  },
];

interface CheckoutFormProps {
  readonly subtotal: number;
  readonly itemCount: number;
  readonly onCheckoutComplete?: () => void;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export function CheckoutForm({ subtotal, itemCount, onCheckoutComplete }: CheckoutFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"shipping" | "delivery" | "payment">("shipping");
  const [selectedShipping, setSelectedShipping] = useState<string>("standard");
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ShippingFormData>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      state: "",
    },
  });

  const watchedState = watch("state");

  // Calculate shipping cost
  const shippingCost = subtotal >= 1200
    ? selectedShipping === "free" ? 0 : SHIPPING_METHODS.find(m => m.id === selectedShipping)?.price ?? 79
    : SHIPPING_METHODS.find(m => m.id === selectedShipping)?.price ?? 79;

  // Calculate totals
  const tax = subtotal * 0.1;
  const total = subtotal + shippingCost + tax;

  const onShippingSubmit = (data: ShippingFormData) => {
    // Store shipping details (could use a store or localStorage)
    localStorage.setItem("checkout-shipping", JSON.stringify(data));
    setStep("delivery");
  };

  const onDeliverySubmit = () => {
    localStorage.setItem("checkout-shipping-method", selectedShipping);
    setStep("payment");
  };

  const onPaymentSubmit = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clear cart and redirect to confirmation
    onCheckoutComplete?.();
    router.push("/order-confirmation");
  };

  const steps = [
    { id: "shipping", label: "Shipping", icon: MapPin },
    { id: "delivery", label: "Delivery", icon: Truck },
    { id: "payment", label: "Payment", icon: CreditCard },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      {/* Main Form */}
      <div className="space-y-6">
        {/* Step Indicator */}
        <nav className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <ol className="flex items-center gap-2">
            {steps.map((s, index) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isCompleted = steps.findIndex(st => st.id === step) > index;
              
              return (
                <li key={s.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCompleted) setStep(s.id as typeof step);
                    }}
                    disabled={!isActive && !isCompleted}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive && "bg-primary/10 text-primary",
                      isCompleted && "text-primary hover:bg-primary/5",
                      !isActive && !isCompleted && "text-muted-foreground"
                    )}
                  >
                    <div className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isActive || isCompleted ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {isCompleted ? (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <ChevronRight className="mx-1 h-4 w-4 text-muted-foreground" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step 1: Shipping Address */}
        {step === "shipping" && (
          <form onSubmit={handleSubmit(onShippingSubmit)} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">Shipping Address</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your delivery details for Australian shipping.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  className={cn("mt-1.5", errors.email && "border-destructive")}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  className={cn("mt-1.5", errors.firstName && "border-destructive")}
                  {...register("firstName")}
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Smith"
                  className={cn("mt-1.5", errors.lastName && "border-destructive")}
                  {...register("lastName")}
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0412 345 678"
                  className={cn("mt-1.5", errors.phone && "border-destructive")}
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street"
                  className={cn("mt-1.5", errors.address && "border-destructive")}
                  {...register("address")}
                />
                {errors.address && (
                  <p className="mt-1 text-xs text-destructive">{errors.address.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="apartment">Apartment, Suite, etc. (optional)</Label>
                <Input
                  id="apartment"
                  placeholder="Unit 4"
                  className="mt-1.5"
                  {...register("apartment")}
                />
              </div>

              <div>
                <Label htmlFor="suburb">Suburb</Label>
                <Input
                  id="suburb"
                  placeholder="Sydney"
                  className={cn("mt-1.5", errors.suburb && "border-destructive")}
                  {...register("suburb")}
                />
                {errors.suburb && (
                  <p className="mt-1 text-xs text-destructive">{errors.suburb.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="state">State / Territory</Label>
                <Select
                  value={watchedState}
                  onValueChange={(value) => {
                    register("state").onChange({ target: { value } });
                  }}
                >
                  <SelectTrigger className={cn("mt-1.5", errors.state && "border-destructive")}>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.state && (
                  <p className="mt-1 text-xs text-destructive">{errors.state.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  placeholder="2000"
                  maxLength={4}
                  className={cn("mt-1.5", errors.postcode && "border-destructive")}
                  {...register("postcode")}
                />
                {errors.postcode && (
                  <p className="mt-1 text-xs text-destructive">{errors.postcode.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" className="mt-6 w-full">
              Continue to Delivery
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        )}

        {/* Step 2: Delivery Method */}
        {step === "delivery" && (
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">Delivery Method</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose your preferred shipping option.
            </p>

            <div className="mt-6 space-y-3">
              {SHIPPING_METHODS.map((method) => {
                const Icon = method.icon;
                const isDisabled = method.id === "free" && subtotal < 1200;
                
                return (
                  <label
                    key={method.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors",
                      selectedShipping === method.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-secondary/50",
                      isDisabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={method.id}
                      checked={selectedShipping === method.id}
                      onChange={() => setSelectedShipping(method.id)}
                      disabled={isDisabled}
                      className="h-4 w-4 text-primary"
                    />
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">{method.name}</p>
                        <p className="font-bold text-foreground">
                          {method.price === 0 ? "FREE" : currencyFormatter.format(method.price)}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setStep("shipping")} className="flex-1">
                Back
              </Button>
              <Button onClick={onDeliverySubmit} className="flex-1">
                Continue to Payment
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === "payment" && (
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">Payment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete your order with Stripe secure payment.
            </p>

            <div className="mt-6 space-y-4">
              {/* Stripe Payment Placeholder */}
              <div className="rounded-xl border-2 border-dashed border-border bg-secondary/30 p-8 text-center">
                <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-sm font-medium text-foreground">Stripe Payment Integration</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Secure credit card processing will be integrated here.
                </p>
              </div>

              {/* Order Summary for Mobile */}
              <div className="rounded-xl bg-secondary/50 p-4 lg:hidden">
                <p className="text-sm font-semibold text-foreground">Order Total</p>
                <p className="text-2xl font-black text-foreground">{currencyFormatter.format(total)}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setStep("delivery")} className="flex-1" disabled={isProcessing}>
                Back
              </Button>
              <Button 
                onClick={onPaymentSubmit} 
                className="flex-1"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Pay {currencyFormatter.format(total)}
                  </>
                )}
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              By placing this order, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        )}
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
            <span className="font-medium text-muted-foreground">Subtotal</span>
            <span className="font-semibold text-foreground">{currencyFormatter.format(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-muted-foreground">Shipping</span>
            <span className="font-semibold text-foreground">
              {shippingCost === 0 ? "FREE" : currencyFormatter.format(shippingCost)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-muted-foreground">GST (10%)</span>
            <span className="font-semibold text-foreground">{currencyFormatter.format(tax)}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-secondary/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">Grand Total</span>
            <span className="text-2xl font-black text-foreground">{currencyFormatter.format(total)}</span>
          </div>
        </div>

        <div className="mt-5 space-y-2">
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
      </aside>
    </div>
  );
}
