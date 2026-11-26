"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Address } from "@prisma/client";
import {
  MapPin,
  Check,
  Building,
  Navigation,
  Globe,
  ArrowLeft,
  ArrowRight,
  Mail,
  User,
  Phone,
  X,
  Loader2,
} from "lucide-react";
import { cleanAustralianSuburb } from "@/lib/data/australian-suburbs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addressSchema, type AddressInput } from "@/lib/validations/address";
import { createAddress, updateAddress } from "@/lib/actions/address";
import { AddressAutocomplete } from "@/components/account/address-autocomplete";

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

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

interface CheckoutAddressDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly editingAddress: Address | null;
  readonly onClearEditing: () => void;
  readonly isAuthenticated: boolean;
  readonly userId?: string;
  readonly userProfile?: { name: string; phone: string };
  readonly guestEmail: string;
  readonly onGuestEmailChange: (email: string) => void;
  readonly guestAddress: (AddressInput & { email?: string }) | null;
  readonly onGuestAddressSaved: (address: AddressInput & { email?: string }) => void;
  readonly onAddressCreated: (address: Address) => void;
  readonly onAddressUpdated: (address: Address) => void;
}

/**
 * Lazy-loaded 2-step add/edit delivery address dialog for checkout.
 * Keeps react-hook-form, zod, Radix Dialog/Select, and Google Places autocomplete
 * out of the initial /checkout JavaScript bundle.
 */
export function CheckoutAddressDialog({
  open,
  onOpenChange,
  editingAddress,
  onClearEditing,
  isAuthenticated,
  userId,
  userProfile,
  guestEmail,
  onGuestEmailChange,
  guestAddress,
  onGuestAddressSaved,
  onAddressCreated,
  onAddressUpdated,
}: CheckoutAddressDialogProps) {
  const { toast } = useToast();
  const [addressStep, setAddressStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [guestEmailError, setGuestEmailError] = useState<string | null>(null);

  const {
    register: registerAddress,
    handleSubmit: handleAddressSubmit,
    reset: resetAddress,
    setValue: setAddressValue,
    trigger: triggerAddress,
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

  // Sync form values whenever the dialog opens or the target address changes
  useEffect(() => {
    if (!open) return;
    setAddressStep(1);
    setGuestEmailError(null);
    if (editingAddress) {
      resetAddress({
        name: editingAddress.name || userProfile?.name || "",
        phone: editingAddress.phone || userProfile?.phone || "",
        line1: editingAddress.line1,
        line2: editingAddress.line2 || undefined,
        suburb: editingAddress.suburb,
        state: editingAddress.state,
        postcode: editingAddress.postcode,
        country: editingAddress.country || "AU",
      });
    } else if (!isAuthenticated && guestAddress) {
      resetAddress({
        name: guestAddress.name || "",
        phone: guestAddress.phone || "",
        line1: guestAddress.line1 || "",
        line2: guestAddress.line2 || undefined,
        suburb: guestAddress.suburb || "",
        state: guestAddress.state || "",
        postcode: guestAddress.postcode || "",
        country: guestAddress.country || "AU",
      });
    } else {
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
    }
  }, [open, editingAddress, isAuthenticated, guestAddress, userProfile, resetAddress]);

  const handleProceedToStep2 = async () => {
    if (!isAuthenticated) {
      if (!guestEmail.trim()) {
        setGuestEmailError("Email address is required");
        return;
      }
      if (!isValidEmail(guestEmail)) {
        setGuestEmailError("Please enter a valid email address");
        return;
      }
      setGuestEmailError(null);
    }
    const isValid = await triggerAddress(["name", "phone"]);
    if (isValid) {
      setAddressStep(2);
    }
  };

  const onAddressDialogSubmit = async (data: AddressInput) => {
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

    const cleanData: AddressInput = {
      name: data.name.trim(),
      line1: data.line1.trim(),
      line2: data.line2?.trim() || undefined,
      suburb: cleanAustralianSuburb(data.suburb),
      state: data.state.trim().toUpperCase() as AddressInput["state"],
      postcode: data.postcode.replace(/\D/g, "").slice(0, 4),
      country: "AU",
      phone: data.phone.trim(),
    };

    setIsLoading(true);
    try {
      if (!isAuthenticated || !userId) {
        onGuestAddressSaved({ ...cleanData, email: guestEmail.trim().toLowerCase() });
        onOpenChange(false);
        setAddressStep(1);
        toast({ title: "Address saved", description: "Your delivery address has been set." });
        return;
      }
      if (editingAddress) {
        const result = await updateAddress(editingAddress.id, cleanData);
        if (result.error) {
          if (result.error === "Unauthorized") {
            onGuestAddressSaved({ ...cleanData, email: guestEmail.trim().toLowerCase() });
            onOpenChange(false);
            setAddressStep(1);
            toast({ title: "Address saved", description: "Delivery address set for this order." });
            return;
          }
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else if (result.address) {
          onAddressUpdated(result.address);
          toast({ title: "Address updated", description: "Your address has been saved." });
          onOpenChange(false);
          setAddressStep(1);
        }
      } else {
        const result = await createAddress(cleanData);
        if (result.error) {
          if (result.error === "Unauthorized") {
            onGuestAddressSaved({ ...cleanData, email: guestEmail.trim().toLowerCase() });
            onOpenChange(false);
            setAddressStep(1);
            toast({ title: "Address saved", description: "Delivery address set for this order." });
            return;
          }
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else if (result.address) {
          onAddressCreated(result.address);
          toast({ title: "Address saved", description: "Your address has been added." });
          onOpenChange(false);
          setAddressStep(1);
        }
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClearEditing();
          setIsLoading(false);
          setAddressStep(1);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[calc(100%-2rem)] overflow-y-auto">
        <DialogHeader className="pb-1">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MapPin className="h-5 w-5 text-primary" />
              {editingAddress ? "Edit Delivery Details" : "Delivery Details"}
            </DialogTitle>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              Step {addressStep} of 2
            </span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {addressStep === 1
              ? "Step 1: Contact details for delivery updates & receipt"
              : "Step 2: Enter delivery street address, suburb, and postcode"}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-2 gap-2 my-2 p-1.5 bg-secondary/50 rounded-xl border border-border/50">
          <button
            type="button"
            onClick={() => setAddressStep(1)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left",
              addressStep === 1
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                addressStep === 1 ? "bg-primary text-white" : "bg-emerald-600 text-white"
              )}
            >
              {addressStep === 2 ? <Check className="h-3 w-3" /> : "1"}
            </div>
            <div className="min-w-0">
              <p className="truncate leading-none">1. Contact</p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleProceedToStep2}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left",
              addressStep === 2
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                addressStep === 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              )}
            >
              2
            </div>
            <div className="min-w-0">
              <p className="truncate leading-none">2. Address</p>
            </div>
          </button>
        </div>

        <form onSubmit={handleAddressSubmit(onAddressDialogSubmit)} className="space-y-4 pt-1">
          {/* STEP 1: Name & Mobile Number (and Email for guest) */}
          <div className={cn("space-y-4", addressStep !== 1 && "hidden")}>
            {!isAuthenticated && (
              <div className="space-y-1.5">
                <Label htmlFor="dlg-email" className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dlg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={guestEmail}
                  onChange={(e) => {
                    const value = e.target.value;
                    onGuestEmailChange(value);
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
                {guestEmailError ? (
                  <p id="email-error" className="text-xs text-destructive">{guestEmailError}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">We&apos;ll send order confirmation and tracking updates to this email.</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="dlg-name" className="text-sm font-medium flex items-center gap-1.5">
                <User className="h-4 w-4 text-muted-foreground" />
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                aria-invalid={!!addressErrors.name}
                aria-describedby={addressErrors.name ? "dlg-name-error" : undefined}
                id="dlg-name"
                placeholder="e.g. John Smith"
                {...registerAddress("name")}
              />
              {addressErrors.name && (
                <p id="dlg-name-error" role="alert" className="text-xs text-destructive">{addressErrors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dlg-phone" className="text-sm font-medium flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Mobile Number <span className="text-destructive">*</span>
              </Label>
              <Input
                aria-invalid={!!addressErrors.phone}
                aria-describedby={addressErrors.phone ? "dlg-phone-error" : undefined}
                id="dlg-phone"
                type="tel"
                placeholder="e.g. 0412 345 678"
                {...registerAddress("phone")}
              />
              {addressErrors.phone ? (
                <p id="dlg-phone-error" role="alert" className="text-xs text-destructive">{addressErrors.phone.message}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Real-time delivery tracking and updates will be sent to this mobile number.</p>
              )}
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClearEditing();
                  setIsLoading(false);
                  setAddressStep(1);
                  onOpenChange(false);
                }}
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
              <Button type="button" onClick={handleProceedToStep2} className="w-full sm:w-auto">
                Continue to Address
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </DialogFooter>
          </div>

          {/* STEP 2: Delivery Address */}
          <div className={cn("space-y-3.5", addressStep !== 2 && "hidden")}>
            <div className="space-y-1.5">
              <AddressAutocomplete
                value={watchAddress("line1")}
                onChange={(val) => setAddressValue("line1", val, { shouldValidate: true })}
                onAddressSelect={(addr) => {
                  setAddressValue("line1", addr.line1, { shouldValidate: true });
                  if (addr.line2) setAddressValue("line2", addr.line2);
                  if (addr.suburb) setAddressValue("suburb", cleanAustralianSuburb(addr.suburb), { shouldValidate: true });
                  if (addr.state) setAddressValue("state", addr.state, { shouldValidate: true });
                  if (addr.postcode) setAddressValue("postcode", addr.postcode.replace(/\D/g, "").slice(0, 4), { shouldValidate: true });
                  setAddressValue("country", addr.country || "AU");
                }}
                error={addressErrors.line1?.message}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dlg-line2" className="text-sm font-medium flex items-center gap-1.5">
                <Building className="h-4 w-4 text-muted-foreground" />
                Apartment, Suite, Unit <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
              </Label>
              <Input
                id="dlg-line2"
                placeholder="e.g. Apt 4B, Level 2"
                {...registerAddress("line2")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dlg-suburb" className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Suburb / City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dlg-suburb"
                placeholder="e.g. Adelaide, Sydney, Melbourne, Golden Grove"
                {...registerAddress("suburb")}
              />
              {addressErrors.suburb && (
                <p id="dlg-suburb-error" role="alert" className="text-xs text-destructive">{addressErrors.suburb.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dlg-state" className="text-sm font-medium flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  State <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={addressState || ""}
                  onValueChange={(v) => setAddressValue("state", v, { shouldValidate: true })}
                >
                  <SelectTrigger
                    id="dlg-state"
                    aria-invalid={!!addressErrors.state}
                    aria-describedby={addressErrors.state ? "dlg-state-error" : undefined}
                    className={cn(addressErrors.state && "border-destructive")}
                  >
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addressErrors.state && (
                  <p id="dlg-state-error" role="alert" className="text-xs text-destructive">{addressErrors.state.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dlg-postcode" className="text-sm font-medium flex items-center gap-1.5">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  Postcode <span className="text-destructive">*</span>
                </Label>
                <Input
                  aria-invalid={!!addressErrors.postcode}
                  aria-describedby={addressErrors.postcode ? "dlg-postcode-error" : undefined}
                  id="dlg-postcode"
                  placeholder="e.g. 5000, 2000, 5125"
                  maxLength={4}
                  {...registerAddress("postcode")}
                />
                {addressErrors.postcode && (
                  <p id="dlg-postcode-error" role="alert" className="text-xs text-destructive">{addressErrors.postcode.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground py-1.5 px-3 bg-secondary/30 rounded-lg">
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Country: <strong>Australia (AU)</strong>
              </span>
              <span>Tracked delivery</span>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddressStep(1)}
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back to Contact
              </Button>
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" />{editingAddress ? "Update Address" : "Save & Deliver Here"}</>
                )}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
