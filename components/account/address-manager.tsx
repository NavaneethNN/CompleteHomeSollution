"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  MapPin,
  Home,
  Building,
  MapPinned,
  Navigation,
  Globe,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  User,
  Phone,
  Sparkles,
} from "lucide-react";
import { cleanAustralianSuburb } from "@/lib/data/australian-suburbs";
import { Address } from "@prisma/client";
import { cn } from "@/lib/utils";
import { addressSchema, AddressInput } from "@/lib/validations/address";
import {
  createAddress,
  updateAddress,
  deleteAddress,
} from "@/lib/actions/address";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { AddressAutocomplete } from "./address-autocomplete";
import { SuburbSelector } from "./suburb-selector";

const AUSTRALIAN_STATES = [
  { value: "ACT", label: "Australian Capital Territory" },
  { value: "NSW", label: "New South Wales" },
  { value: "NT", label: "Northern Territory" },
  { value: "QLD", label: "Queensland" },
  { value: "SA", label: "South Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "VIC", label: "Victoria" },
  { value: "WA", label: "Western Australia" },
] as const;

interface AddressManagerProps {
  addresses: Address[];
  error?: string;
  userProfile?: { name: string; phone: string };
}

export function AddressManager({ addresses: initialAddresses, error, userProfile }: AddressManagerProps) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [addressStep, setAddressStep] = useState<1 | 2>(1);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger: triggerValidation,
    formState: { errors },
    watch,
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

  const selectedState = watch("state");

  const handleProceedToStep2 = async () => {
    const valid = await triggerValidation(["name", "phone"]);
    if (valid) {
      setAddressStep(2);
    }
  };

  const openAddDialog = () => {
    setEditingAddress(null);
    setAddressStep(1);
    reset({
      name: userProfile?.name || "",
      phone: userProfile?.phone || "",
      line1: "",
      line2: undefined,
      suburb: "",
      state: "",
      postcode: "",
      country: "AU",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    setAddressStep(1);
    reset({
      name: address.name || userProfile?.name || "",
      phone: address.phone || userProfile?.phone || "",
      line1: address.line1,
      line2: address.line2 || undefined,
      suburb: address.suburb,
      state: address.state,
      postcode: address.postcode,
      country: address.country || "AU",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: AddressInput) => {
    const cleanData: AddressInput = {
      name: data.name.trim(),
      line1: data.line1.trim(),
      line2: data.line2?.trim() || undefined,
      suburb: cleanAustralianSuburb(data.suburb),
      state: data.state.trim().toUpperCase(),
      postcode: data.postcode.replace(/\D/g, "").slice(0, 4),
      country: "AU",
      phone: data.phone.trim(),
    };

    setIsLoading(true);
    try {
      if (editingAddress) {
        const result = await updateAddress(editingAddress.id, cleanData);
        if (result.error) {
          toast({
            title: "Error",
            description: result.error,
            variant: "destructive",
          });
        } else if (result.address) {
          setAddresses(
            addresses.map((a) => (a.id === editingAddress.id ? result.address : a))
          );
          toast({
            title: "Success",
            description: "Address updated successfully.",
            variant: "success",
          });
          setIsDialogOpen(false);
          setAddressStep(1);
        }
      } else {
        const result = await createAddress(cleanData);
        if (result.error) {
          toast({
            title: "Error",
            description: result.error,
            variant: "destructive",
          });
        } else if (result.address) {
          setAddresses([result.address, ...addresses]);
          toast({
            title: "Success",
            description: "Address added successfully.",
            variant: "success",
          });
          setIsDialogOpen(false);
          setAddressStep(1);
        }
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsLoading(true);
    try {
      const result = await deleteAddress(id);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setAddresses(addresses.filter((a) => a.id !== id));
        toast({
          title: "Success",
          description: "Address deleted successfully.",
          variant: "success",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
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

  return (
    <main className="flex-1 min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Addresses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your delivery addresses for faster checkout
          </p>
        </div>
        <Button onClick={openAddDialog} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add New Address
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Error loading addresses</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Addresses Grid */}
      {addresses.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <MapPin className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No addresses saved</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm">
              Add a delivery address to make checkout faster and easier
            </p>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <Card
              key={address.id}
              className="border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {(address.name || address.phone) && (
                      <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {address.name && <p className="text-sm font-semibold text-foreground">{address.name}</p>}
                        {address.phone && <p className="text-sm text-muted-foreground">{address.phone}</p>}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {formatAddress(address).map((line, i) => (
                        <p
                          key={i}
                          className={`text-sm ${i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(address)}
                    className="h-8 px-3"
                  >
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmId(address.id)}
                    className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog — Clean 2-Step Experience */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingAddress(null);
          setAddressStep(1);
        }
        setIsDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-1">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <MapPin className="h-5 w-5 text-primary" />
                {editingAddress ? "Edit Address Details" : "Add New Delivery Address"}
              </DialogTitle>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                Step {addressStep} of 2
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {addressStep === 1
                ? "Step 1: Contact details for courier delivery SMS & notifications"
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
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                addressStep === 1
                  ? "bg-primary text-white"
                  : "bg-emerald-600 text-white"
              )}>
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
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                addressStep === 2
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground"
              )}>
                2
              </div>
              <div className="min-w-0">
                <p className="truncate leading-none">2. Address</p>
              </div>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 pt-1">
            {/* STEP 1: Name & Phone */}
            <div className={cn("space-y-4", addressStep !== 1 && "hidden")}>
              <div className="space-y-1.5">
                <Label htmlFor="addr-name" className="text-sm font-medium flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addr-name"
                  placeholder="e.g. John Smith"
                  {...register("name")}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="addr-phone" className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Mobile Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addr-phone"
                  type="tel"
                  placeholder="e.g. 0412 345 678"
                  {...register("phone")}
                />
                {errors.phone ? (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Couriers Please sends delivery SMS alerts to this number.</p>
                )}
              </div>

              <DialogFooter className="gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleProceedToStep2}
                  className="w-full sm:w-auto"
                >
                  Continue to Address
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </DialogFooter>
            </div>

            {/* STEP 2: Delivery Address */}
            <div className={cn("space-y-3.5", addressStep !== 2 && "hidden")}>
              {/* 1. Street Address Line 1 */}
              <div className="space-y-1.5">
                <AddressAutocomplete
                  value={watch("line1")}
                  onChange={(value) => setValue("line1", value, { shouldValidate: true })}
                  onAddressSelect={(address) => {
                    setValue("line1", address.line1, { shouldValidate: true });
                    if (address.line2) setValue("line2", address.line2);
                    if (address.suburb) setValue("suburb", cleanAustralianSuburb(address.suburb), { shouldValidate: true });
                    if (address.state) setValue("state", address.state, { shouldValidate: true });
                    if (address.postcode) setValue("postcode", address.postcode.replace(/\D/g, "").slice(0, 4), { shouldValidate: true });
                    setValue("country", address.country || "AU");
                  }}
                  error={errors.line1?.message}
                  disabled={isLoading}
                />
              </div>

              {/* 2. Street Address Line 2 */}
              <div className="space-y-1.5">
                <Label htmlFor="line2" className="text-sm font-medium flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  Apartment, Suite, Unit <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                </Label>
                <Input
                  id="line2"
                  type="text"
                  placeholder="e.g. Apt 4B, Floor 2"
                  {...register("line2")}
                />
                {errors.line2 && (
                  <p className="text-xs text-destructive">{errors.line2.message}</p>
                )}
              </div>

              {/* 3. Suburb */}
              <div className="space-y-1.5">
                <Label htmlFor="addr-suburb" className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Suburb / City <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addr-suburb"
                  type="text"
                  placeholder="e.g. Adelaide, Sydney, Melbourne, Golden Grove"
                  {...register("suburb")}
                />
                {errors.suburb && (
                  <p className="text-xs text-destructive">{errors.suburb.message}</p>
                )}
              </div>

              {/* 4. State & Postcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="addr-state" className="text-sm font-medium flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    State <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedState || ""}
                    onValueChange={(value) => setValue("state", value, { shouldValidate: true })}
                  >
                    <SelectTrigger id="addr-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUSTRALIAN_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state && (
                    <p className="text-xs text-destructive">{errors.state.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="addr-postcode" className="text-sm font-medium flex items-center gap-1.5">
                    <Navigation className="h-4 w-4 text-muted-foreground" />
                    Postcode <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="addr-postcode"
                    type="text"
                    placeholder="e.g. 5000, 2000, 5125"
                    maxLength={4}
                    {...register("postcode")}
                  />
                  {errors.postcode && (
                    <p className="text-xs text-destructive">{errors.postcode.message}</p>
                  )}
                </div>
              </div>

              {/* Country summary */}
              <div className="flex items-center justify-between text-xs text-muted-foreground py-1.5 px-3 bg-secondary/30 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Country: <strong>Australia (AU)</strong>
                </span>
                <span>Couriers Please delivery</span>
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
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {editingAddress ? "Update Address" : "Save Address"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
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
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
