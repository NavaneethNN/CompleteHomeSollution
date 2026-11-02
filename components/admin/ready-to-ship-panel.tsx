"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Truck,
  CheckCircle2,
  ExternalLink,
  Printer,
  Loader2,
  Copy,
  RefreshCw,
  PackageCheck,
  AlertTriangle,
  Scale,
  Ruler,
  FileText,
} from "lucide-react";

type OrderShipmentData = {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippingServiceCode: string | null;
  ship123OrderNo: string | null;
  ship123LabelUrl: string | null;
  packageName?: string | null;
  packedWeight?: number | null;
  packedLength?: number | null;
  packedWidth?: number | null;
  packedHeight?: number | null;
  packageOverride?: boolean | null;
};

type RecipientInfo = {
  name: string;
  line1?: string;
  suburb: string;
  state: string;
  postcode: string;
};

export function ReadyToShipPanel({
  orderId,
  currentStatus,
  currentTrackingNumber,
  currentCarrier,
}: {
  orderId: string;
  currentStatus: string;
  currentTrackingNumber?: string | null;
  currentCarrier?: string | null;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderShipmentData | null>(null);
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null);
  const [isBooked, setIsBooked] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("Safe drop");
  const [jobNumber, setJobNumber] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string>(currentStatus);

  // Package dimensions and weight confirmation states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [lengthStr, setLengthStr] = useState<string>("30");
  const [widthStr, setWidthStr] = useState<string>("25");
  const [heightStr, setHeightStr] = useState<string>("20");
  const [weightStr, setWeightStr] = useState<string>("1.0");

  useEffect(() => {
    setOrderStatus(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/orders/${orderId}/ready-to-ship`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load shipment details");
        if (controller.signal.aborted) return;
        setOrder(data.order);
        if (data.recipient) {
          setRecipient(data.recipient);
        }
        if (data.order?.status) {
          setOrderStatus(data.order.status);
        }
        if (data.order?.packedLength) setLengthStr(String(data.order.packedLength));
        if (data.order?.packedWidth) setWidthStr(String(data.order.packedWidth));
        if (data.order?.packedHeight) setHeightStr(String(data.order.packedHeight));
        if (data.order?.packedWeight) setWeightStr(String(data.order.packedWeight));

        setIsBooked(data.isBooked);
        setIsTestMode(data.isTestMode === true);
        setTrackingUrl(data.trackingUrl);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load shipment details");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [orderId]);

  // Derived metrics
  const parsedLength = parseFloat(lengthStr) || 0;
  const parsedWidth = parseFloat(widthStr) || 0;
  const parsedHeight = parseFloat(heightStr) || 0;
  const parsedWeight = parseFloat(weightStr) || 0;

  const cubicWeight = useMemo(() => {
    if (parsedLength > 0 && parsedWidth > 0 && parsedHeight > 0) {
      return Math.round(((parsedLength * parsedWidth * parsedHeight) / 4000) * 100) / 100;
    }
    return 0;
  }, [parsedLength, parsedWidth, parsedHeight]);

  const billableWeight = useMemo(() => {
    return Math.max(parsedWeight, cubicWeight);
  }, [parsedWeight, cubicWeight]);

  const hasInvalidDimensions =
    parsedLength <= 0 ||
    parsedWidth <= 0 ||
    parsedHeight <= 0 ||
    parsedWeight <= 0 ||
    parsedLength > 300 ||
    parsedWidth > 300 ||
    parsedHeight > 300 ||
    parsedWeight > 100;

  const isOversized = parsedWeight > 25 || parsedLength > 180 || parsedWidth > 180 || parsedHeight > 180;

  function handleOpenBookingModal() {
    setModalError(null);
    setError(null);
    // Refresh inputs with latest order values if present
    if (order?.packedLength) setLengthStr(String(order.packedLength));
    if (order?.packedWidth) setWidthStr(String(order.packedWidth));
    if (order?.packedHeight) setHeightStr(String(order.packedHeight));
    if (order?.packedWeight) setWeightStr(String(order.packedWeight));
    setIsConfirmOpen(true);
  }

  async function handleConfirmAndBook() {
    if (booking) return;

    if (hasInvalidDimensions) {
      setModalError("Please enter valid positive dimensions and weight (max 300cm and 100kg).");
      return;
    }

    setBooking(true);
    setModalError(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/ready-to-ship`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packedLength: parsedLength,
          packedWidth: parsedWidth,
          packedHeight: parsedHeight,
          packedWeight: parsedWeight,
          specialInstructions: specialInstructions.trim().slice(0, 15) || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Couriers Please booking failed");
      }

      setIsBooked(true);
      setTrackingUrl(data.trackingUrl);
      setJobNumber(data.jobNumber || null);
      setOrderStatus("SHIPPED");
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              carrier: "Couriers Please",
              trackingNumber: data.consignmentCode,
              ship123OrderNo: data.consignmentCode,
              ship123LabelUrl: data.labelUrl,
              packedLength: data.packedLength ?? parsedLength,
              packedWidth: data.packedWidth ?? parsedWidth,
              packedHeight: data.packedHeight ?? parsedHeight,
              packedWeight: data.packedWeight ?? parsedWeight,
              status: "SHIPPED",
            }
          : prev
      );

      setIsConfirmOpen(false);
      toast.success("Order booked with Couriers Please! Pickup driver arranged.");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to arrange shipment with Couriers Please";
      setModalError(msg);
      setError(msg);
      toast.error(msg);
    } finally {
      setBooking(false);
    }
  }

  async function handleSimulateDelivery() {
    if (simulating) return;
    setSimulating(true);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/simulate-delivery`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to simulate delivery");
      }

      setOrderStatus("DELIVERED");
      setOrder((prev) => (prev ? { ...prev, status: "DELIVERED" } : prev));
      toast.success("Courier marked order as DELIVERED! Customer delivery email sent.");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delivery simulation failed";
      toast.error(msg);
    } finally {
      setSimulating(false);
    }
  }

  async function handleSyncStatus() {
    if (syncing) return;
    setSyncing(true);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/couriersplease/sync`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync status");
      }

      if (data.updated && data.orderStatus === "DELIVERED") {
        setOrderStatus("DELIVERED");
        setOrder((prev) => (prev ? { ...prev, status: "DELIVERED" } : prev));
        toast.success(data.message || "Order marked as DELIVERED by courier!");
        router.refresh();
      } else {
        toast.info(data.message || "Courier status synced (In Transit)");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sync status";
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  }

  const trackingCode = order?.trackingNumber || currentTrackingNumber;
  const isCouriersPleaseCarrier =
    (order?.carrier || currentCarrier)?.toLowerCase().includes("couriers please") || isBooked;
  const isDelivered = orderStatus === "DELIVERED";

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-emerald-600" />
            Couriers Please Shipping
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {isTestMode && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">
                Test Mode
              </Badge>
            )}
            {isDelivered ? (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-xs">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Delivered
              </Badge>
            ) : isCouriersPleaseCarrier && trackingCode ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Booked
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                Ready to Dispatch
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {loading && <p className="text-muted-foreground text-xs">Checking shipment status…</p>}

          {error && (
            <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          {isDelivered && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Order Delivered to Customer
              </div>
              <p className="text-emerald-700">
                The courier marked this shipment as delivered. The customer has been sent their delivery confirmation email.
              </p>
            </div>
          )}

          {isCouriersPleaseCarrier && trackingCode ? (
            <div className="space-y-3 pt-1">
              <div className="rounded-lg bg-slate-50 p-3 space-y-2 border border-slate-100">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Carrier</span>
                  <span className="font-semibold text-slate-800">Couriers Please</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Consignment / Tracking</span>
                  <div className="flex items-center gap-1.5 font-mono font-medium text-slate-900">
                    <span>{trackingCode}</span>
                    <button
                      type="button"
                      title="Copy tracking code"
                      onClick={() => {
                        navigator.clipboard.writeText(trackingCode);
                        toast.success("Copied tracking code to clipboard");
                      }}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {jobNumber && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Pickup Job #</span>
                    <span className="font-mono text-slate-800">{jobNumber}</span>
                  </div>
                )}
                {order?.packedLength && order?.packedWeight && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-slate-200/60 pt-2 mt-1">
                    <span>Booked Dimensions</span>
                    <span className="font-medium text-slate-800">
                      {order.packedLength}×{order.packedWidth}×{order.packedHeight} cm · {order.packedWeight} kg
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center gap-1.5 text-xs"
                  asChild
                >
                  <a
                    href={`/api/admin/orders/${orderId}/couriersplease/label`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print Shipping Label
                  </a>
                </Button>

                {trackingUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full flex items-center justify-center gap-1.5 text-xs"
                    asChild
                  >
                    <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Track Shipment
                    </a>
                  </Button>
                )}
              </div>

              {!isDelivered && (
                <div className="pt-2 space-y-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-medium">Delivery Status Automation</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-slate-600 hover:text-slate-900"
                      onClick={handleSyncStatus}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      )}
                      Check Courier Status
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSimulateDelivery}
                    disabled={simulating}
                    className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 text-xs h-8 flex items-center justify-center gap-1.5 font-medium"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Marking as Delivered…
                      </>
                    ) : (
                      <>
                        <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Simulate Courier Delivery (Test)
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Automatic updates: When Couriers Please marks this parcel as delivered, our webhook updates the status to DELIVERED and immediately sends the customer an email. Click the test button above to verify this flow anytime!
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Before booking, please verify the parcel measurements and driver instructions. Clicking below opens the confirmation screen to confirm exact dimensions and weight with Couriers Please.
              </p>

              {/* Package Summary Card */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <PackageCheck className="h-4 w-4 text-primary" />
                    Packaging Box: {order?.packageName || "Standard Box"}
                  </span>
                  {order?.packageOverride && (
                    <Badge variant="outline" className="text-[10px] text-amber-800 bg-amber-50 border-amber-300">
                      Custom Override
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-600 text-xs pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Dimensions (L×W×H):</span>
                    <span className="font-semibold text-slate-900">
                      {lengthStr} × {widthStr} × {heightStr} cm
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Gross Weight:</span>
                    <span className="font-semibold text-slate-900">{weightStr} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Volumetric (Cubic):</span>
                    <span className="font-mono text-slate-700">{cubicWeight} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Billable Weight:</span>
                    <span className="font-semibold text-emerald-700">{billableWeight.toFixed(2)} kg</span>
                  </div>
                </div>

                {recipient && (
                  <div className="text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                    <span>Destination:</span>
                    <span className="font-medium text-slate-800">
                      {recipient.suburb}, {recipient.state} {recipient.postcode}
                    </span>
                  </div>
                )}
              </div>

              {/* Driver note */}
              <div className="space-y-1">
                <Label htmlFor="specialInstructions" className="text-xs">
                  Driver Instructions (Optional)
                </Label>
                <Input
                  id="specialInstructions"
                  value={specialInstructions}
                  maxLength={15}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. Safe drop, Ring bell"
                  className="text-xs h-8"
                />
                <p className="text-[10px] text-muted-foreground">
                  {specialInstructions.length}/15 chars (Couriers Please rule)
                </p>
              </div>

              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all text-xs h-9"
                onClick={handleOpenBookingModal}
                disabled={booking || loading}
              >
                <Truck className="mr-2 h-4 w-4" />
                Book Couriers Please Pickup…
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation & Re-Verification Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Truck className="h-5 w-5 text-emerald-600" />
              Confirm Package Dimensions & Weight
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Please verify or adjust the final parcel measurements before dispatching. Couriers Please will create the consignment and driver pickup with these exact specifications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {modalError && (
              <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                {modalError}
              </div>
            )}

            {/* Dimension Inputs */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5 text-slate-500" />
                Package Dimensions (cm)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="pkg-length" className="text-[11px] text-muted-foreground">Length</Label>
                  <div className="relative mt-1">
                    <Input
                      id="pkg-length"
                      type="number"
                      step="0.5"
                      min="1"
                      max="300"
                      value={lengthStr}
                      onChange={(e) => setLengthStr(e.target.value)}
                      className="text-xs h-8 pr-7 font-mono"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground pointer-events-none">cm</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="pkg-width" className="text-[11px] text-muted-foreground">Width</Label>
                  <div className="relative mt-1">
                    <Input
                      id="pkg-width"
                      type="number"
                      step="0.5"
                      min="1"
                      max="300"
                      value={widthStr}
                      onChange={(e) => setWidthStr(e.target.value)}
                      className="text-xs h-8 pr-7 font-mono"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground pointer-events-none">cm</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="pkg-height" className="text-[11px] text-muted-foreground">Height</Label>
                  <div className="relative mt-1">
                    <Input
                      id="pkg-height"
                      type="number"
                      step="0.5"
                      min="1"
                      max="300"
                      value={heightStr}
                      onChange={(e) => setHeightStr(e.target.value)}
                      className="text-xs h-8 pr-7 font-mono"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground pointer-events-none">cm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Weight Inputs */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-slate-500" />
                Package Weight
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pkg-weight" className="text-[11px] text-muted-foreground">Gross Weight (kg)</Label>
                  <div className="relative mt-1">
                    <Input
                      id="pkg-weight"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      value={weightStr}
                      onChange={(e) => setWeightStr(e.target.value)}
                      className="text-xs h-8 pr-7 font-mono"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground pointer-events-none">kg</span>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Volumetric Weight</Label>
                  <div className="mt-1 h-8 flex items-center px-3 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
                    {cubicWeight} kg
                  </div>
                </div>
              </div>
            </div>

            {/* Calculated Metrics Summary */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span>Charged Billable Weight:</span>
                <span className="font-bold text-emerald-700 font-mono">
                  {billableWeight.toFixed(2)} kg
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Formula:</span>
                <span>max(Actual: {parsedWeight} kg, Volumetric: {cubicWeight} kg)</span>
              </div>
            </div>

            {/* Oversize / Heavy Warning */}
            {isOversized && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-800">Oversized / Heavy Freight Notice</p>
                  <p className="text-[11px] text-amber-700">
                    Standard courier network limit is 25 kg / 180 cm max. Couriers Please drivers may refuse or surcharge oversized parcels.
                  </p>
                </div>
              </div>
            )}

            {/* Destination reminder */}
            {recipient && (
              <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
                <span className="font-medium text-slate-800 block">Delivery Destination:</span>
                <p>{recipient.name}</p>
                <p>
                  {recipient.line1 ? `${recipient.line1}, ` : ""}
                  {recipient.suburb} {recipient.state} {recipient.postcode}
                </p>
              </div>
            )}

            {/* Driver Instructions */}
            <div className="space-y-1">
              <Label htmlFor="modalSpecialInstructions" className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                Driver Instructions (Max 15 characters)
              </Label>
              <Input
                id="modalSpecialInstructions"
                value={specialInstructions}
                maxLength={15}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Safe drop"
                className="text-xs h-8"
              />
              <p className="text-[10px] text-muted-foreground flex justify-between">
                <span>Couriers Please delivery rule</span>
                <span className={specialInstructions.length >= 15 ? "text-amber-600 font-semibold" : ""}>
                  {specialInstructions.length}/15 chars
                </span>
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmOpen(false)}
              disabled={booking}
              className="text-xs"
            >
              Cancel / Edit
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5"
              onClick={handleConfirmAndBook}
              disabled={booking || hasInvalidDimensions}
            >
              {booking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Booking Couriers Please…
                </>
              ) : (
                <>
                  <Truck className="h-3.5 w-3.5" />
                  Confirm & Book Couriers Please
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
