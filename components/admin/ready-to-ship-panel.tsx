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
  Plus,
  Trash2,
} from "lucide-react";
import type { PackedBoxSpec } from "@/lib/shipping-packages";

type EditableBookingBox = {
  label: string;
  quantity: string;
  length: string;
  width: string;
  height: string;
  weight: string;
};

function toEditableBookingBoxes(
  packedBoxes?: PackedBoxSpec[] | null,
  fallback?: {
    packageName?: string | null;
    packedLength?: number | null;
    packedWidth?: number | null;
    packedHeight?: number | null;
    packedWeight?: number | null;
  } | null
): EditableBookingBox[] {
  if (packedBoxes && packedBoxes.length > 0) {
    return packedBoxes.map((b) => ({
      label: b.label,
      quantity: String(b.quantity),
      length: String(b.length),
      width: String(b.width),
      height: String(b.height),
      weight: String(b.weight),
    }));
  }
  return [
    {
      label: fallback?.packageName || "Standard Box",
      quantity: "1",
      length: fallback?.packedLength ? String(fallback.packedLength) : "30",
      width: fallback?.packedWidth ? String(fallback.packedWidth) : "25",
      height: fallback?.packedHeight ? String(fallback.packedHeight) : "20",
      weight: fallback?.packedWeight ? String(fallback.packedWeight) : "1.0",
    },
  ];
}

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
  packedBoxes?: PackedBoxSpec[];
  totalBoxCount?: number;
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
  initialPackaging,
}: {
  orderId: string;
  currentStatus: string;
  currentTrackingNumber?: string | null;
  currentCarrier?: string | null;
  initialPackaging?: {
    packageName?: string | null;
    packedLength?: number | null;
    packedWidth?: number | null;
    packedHeight?: number | null;
    packedWeight?: number | null;
    packedBoxes?: PackedBoxSpec[];
    packageOverride?: boolean | null;
  };
}) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderShipmentData | null>(initialPackaging ? {
    id: orderId,
    status: currentStatus,
    carrier: currentCarrier ?? null,
    trackingNumber: currentTrackingNumber ?? null,
    shippingServiceCode: null,
    ship123OrderNo: null,
    ship123LabelUrl: null,
    packageName: initialPackaging.packageName,
    packedLength: initialPackaging.packedLength,
    packedWidth: initialPackaging.packedWidth,
    packedHeight: initialPackaging.packedHeight,
    packedWeight: initialPackaging.packedWeight,
    packedBoxes: initialPackaging.packedBoxes,
    packageOverride: initialPackaging.packageOverride,
  } : null);
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null);
  const [isBooked, setIsBooked] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialPackaging);
  const [booking, setBooking] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("Authority to leave if safe");
  const [jobNumber, setJobNumber] = useState<string | null>(null);
  const [pickupPending, setPickupPending] = useState(false);
  const [pickupWarning, setPickupWarning] = useState<string | null>(null);
  const [retryingPickup, setRetryingPickup] = useState(false);
  const [createState, setCreateState] = useState<string | null>(null);
  const [knownConsignmentInput, setKnownConsignmentInput] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [courierStatusInfo, setCourierStatusInfo] = useState<{
    status?: string;
    deliveryETA?: string | null;
    events?: Array<{ date: string; description: string; location?: string }>;
  } | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string>(currentStatus);

  // Package dimensions and weight confirmation states (supports 1 or more separate boxes)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [boxesState, setBoxesState] = useState<EditableBookingBox[]>(() =>
    toEditableBookingBoxes(initialPackaging?.packedBoxes, initialPackaging)
  );

  useEffect(() => {
    if (
      initialPackaging?.packedBoxes?.length ||
      initialPackaging?.packedLength ||
      initialPackaging?.packageName
    ) {
      setBoxesState(toEditableBookingBoxes(initialPackaging.packedBoxes, initialPackaging));
    }
    if (initialPackaging?.packageName) {
      setOrder((prev) => ({
        id: orderId,
        status: prev?.status || currentStatus,
        carrier: prev?.carrier || currentCarrier || null,
        trackingNumber: prev?.trackingNumber || currentTrackingNumber || null,
        shippingServiceCode: prev?.shippingServiceCode || null,
        ship123OrderNo: prev?.ship123OrderNo || null,
        ship123LabelUrl: prev?.ship123LabelUrl || null,
        packageName: initialPackaging.packageName,
        packedLength: initialPackaging.packedLength,
        packedWidth: initialPackaging.packedWidth,
        packedHeight: initialPackaging.packedHeight,
        packedWeight: initialPackaging.packedWeight,
        packedBoxes: initialPackaging.packedBoxes,
        packageOverride: initialPackaging.packageOverride,
      }));
    }
  }, [
    initialPackaging?.packedLength,
    initialPackaging?.packedWidth,
    initialPackaging?.packedHeight,
    initialPackaging?.packedWeight,
    initialPackaging?.packedBoxes,
    initialPackaging?.packageName,
    initialPackaging?.packageOverride,
    orderId,
    currentStatus,
    currentCarrier,
    currentTrackingNumber,
  ]);

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
        setBoxesState(toEditableBookingBoxes(data.order?.packedBoxes, data.order));

        setIsBooked(data.isBooked);
        setJobNumber(data.jobNumber || null);
        setPickupPending(Boolean(data.pickupPending));
        setCreateState(data.createState || null);
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

  // Derived metrics across all separate boxes
  const parsedBoxes = useMemo(
    () =>
      boxesState.map((b, idx) => ({
        label: b.label.trim() || `Box ${idx + 1}`,
        quantity: parseInt(b.quantity, 10) || 0,
        length: parseFloat(b.length) || 0,
        width: parseFloat(b.width) || 0,
        height: parseFloat(b.height) || 0,
        weight: parseFloat(b.weight) || 0,
      })),
    [boxesState]
  );

  const totalBoxCount = useMemo(
    () => parsedBoxes.reduce((sum, b) => sum + b.quantity, 0),
    [parsedBoxes]
  );

  const parsedWeight = useMemo(
    () => Math.round(parsedBoxes.reduce((sum, b) => sum + b.weight * b.quantity, 0) * 100) / 100,
    [parsedBoxes]
  );

  const cubicWeight = useMemo(
    () =>
      Math.round(
        parsedBoxes.reduce(
          (sum, b) =>
            b.length > 0 && b.width > 0 && b.height > 0
              ? sum + ((b.length * b.width * b.height) / 4000) * b.quantity
              : sum,
          0
        ) * 100
      ) / 100,
    [parsedBoxes]
  );

  const billableWeight = useMemo(
    () =>
      Math.round(
        parsedBoxes.reduce((sum, b) => {
          const boxCubic = b.length > 0 && b.width > 0 && b.height > 0 ? (b.length * b.width * b.height) / 4000 : 0;
          return sum + Math.max(b.weight, boxCubic) * b.quantity;
        }, 0) * 100
      ) / 100,
    [parsedBoxes]
  );

  const firstBox = parsedBoxes[0] ?? { label: "Box 1", quantity: 1, length: 0, width: 0, height: 0, weight: 0 };

  const hasInvalidDimensions = parsedBoxes.some(
    (b) =>
      b.quantity < 1 ||
      b.length <= 0 ||
      b.width <= 0 ||
      b.height <= 0 ||
      b.weight <= 0 ||
      b.length > 300 ||
      b.width > 300 ||
      b.height > 300 ||
      b.weight > 100
  );

  const isOversized = parsedBoxes.some(
    (b) => b.weight > 25 || b.length > 180 || b.width > 180 || b.height > 180
  );

  function updateBoxRow(index: number, field: keyof EditableBookingBox, value: string) {
    setBoxesState((prev) => prev.map((box, i) => (i === index ? { ...box, [field]: value } : box)));
  }

  function handleOpenBookingModal() {
    setModalError(null);
    setError(null);
    // Refresh inputs with latest order values if present
    setBoxesState(toEditableBookingBoxes(order?.packedBoxes, order));
    setIsConfirmOpen(true);
  }

  async function handleConfirmAndBook() {
    if (booking) return;

    if (hasInvalidDimensions) {
      setModalError("Please enter valid positive quantity, dimensions, and weight for every box (max 300cm and 100kg per box).");
      return;
    }

    setBooking(true);
    setModalError(null);
    setError(null);

    try {
      const payloadBoxes: PackedBoxSpec[] = parsedBoxes.map((b) => ({
        label: b.label,
        quantity: b.quantity,
        length: Math.round(b.length * 10) / 10,
        width: Math.round(b.width * 10) / 10,
        height: Math.round(b.height * 10) / 10,
        weight: Math.round(b.weight * 100) / 100,
      }));

      const res = await fetch(`/api/admin/orders/${orderId}/ready-to-ship`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packedBoxes: payloadBoxes,
          packedLength: payloadBoxes[0].length,
          packedWidth: payloadBoxes[0].width,
          packedHeight: payloadBoxes[0].height,
          packedWeight: parsedWeight,
          specialInstructions: specialInstructions.trim().slice(0, 140) || undefined,
          pickupInstructions: specialInstructions.trim().slice(0, 15) || "Pickup ready",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Couriers Please booking failed");
      }

      setIsBooked(true);
      setTrackingUrl(data.trackingUrl);
      setJobNumber(data.jobNumber || null);
      setPickupPending(Boolean(data.pickupPending));
      setPickupWarning(data.pickupWarning || null);
      setCreateState(data.jobNumber ? `CP_JOB:${data.jobNumber}` : "CP_PICKUP_PENDING");
      setOrderStatus("SHIPPED");
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              carrier: "Couriers Please",
              trackingNumber: data.consignmentCode,
              ship123OrderNo: data.consignmentCode,
              ship123LabelUrl: data.labelUrl,
              packedLength: data.packedLength ?? payloadBoxes[0].length,
              packedWidth: data.packedWidth ?? payloadBoxes[0].width,
              packedHeight: data.packedHeight ?? payloadBoxes[0].height,
              packedWeight: data.packedWeight ?? parsedWeight,
              packedBoxes: data.packedBoxes ?? payloadBoxes,
              totalBoxCount: data.totalBoxCount ?? totalBoxCount,
              status: "SHIPPED",
            }
          : prev
      );

      setIsConfirmOpen(false);
      if (data.pickupWarning) {
        toast.warning(`Consignment created, but pickup needs scheduling: ${data.pickupWarning}`);
      } else {
        toast.success("Order booked with Couriers Please! Pickup driver arranged.");
      }
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

  async function handleRetryPickup() {
    if (retryingPickup) return;
    setRetryingPickup(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/ready-to-ship`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "retry_pickup",
          pickupInstructions: specialInstructions.trim().slice(0, 15) || "Pickup ready",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pickup scheduling failed");
      setJobNumber(data.jobNumber || null);
      setPickupPending(false);
      setPickupWarning(null);
      toast.success(data.message || "Driver pickup scheduled with Couriers Please!");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to schedule driver pickup";
      setPickupWarning(msg);
      toast.error(msg);
    } finally {
      setRetryingPickup(false);
    }
  }

  async function handleReconcileConsignment() {
    const code = knownConsignmentInput.trim();
    if (!code || reconciling) return;
    setReconciling(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/ready-to-ship`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reconcile",
          knownConsignmentCode: code,
          pickupInstructions: specialInstructions.trim().slice(0, 15) || "Pickup ready",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reconcile consignment");
      setIsBooked(true);
      setCreateState(data.jobNumber ? `CP_JOB:${data.jobNumber}` : "CP_PICKUP_PENDING");
      setJobNumber(data.jobNumber || null);
      setPickupPending(Boolean(data.pickupPending));
      setPickupWarning(data.pickupWarning || null);
      setTrackingUrl(data.trackingUrl);
      setOrderStatus("SHIPPED");
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              carrier: "Couriers Please",
              trackingNumber: data.consignmentCode,
              ship123OrderNo: data.consignmentCode,
              ship123LabelUrl: data.labelUrl,
              status: "SHIPPED",
            }
          : prev
      );
      toast.success("Existing Couriers Please consignment reconciled and order marked shipped.");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reconcile consignment";
      setError(msg);
      toast.error(msg);
    } finally {
      setReconciling(false);
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

      if (data.tracking) {
        setCourierStatusInfo({
          status: data.tracking.status,
          deliveryETA: data.tracking.deliveryETA,
          events: data.tracking.events,
        });
      }

      if (data.updated && data.orderStatus) {
        setOrderStatus(data.orderStatus);
        setOrder((prev) => (prev ? { ...prev, status: data.orderStatus } : prev));
        toast.success(data.message || `Order updated to ${data.orderStatus} by courier!`);
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
                <div className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0">
                    {trackingCode.includes(",") ? "Consignments" : "Consignment / Tracking"}
                  </span>
                  <div className="flex flex-col items-end gap-1 font-mono font-medium text-slate-900 text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="break-all">{trackingCode}</span>
                      <button
                        type="button"
                        title="Copy tracking code"
                        onClick={() => {
                          navigator.clipboard.writeText(trackingCode);
                          toast.success("Copied tracking code to clipboard");
                        }}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 shrink-0"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    {trackingCode.includes(",") && (
                      <div className="flex flex-wrap justify-end gap-1 pt-0.5">
                        {trackingCode
                          .split(",")
                          .map((c) => c.trim())
                          .filter(Boolean)
                          .map((code, idx) => (
                            <a
                              key={code}
                              href={`/api/admin/orders/${orderId}/couriersplease/label?code=${encodeURIComponent(code)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-sans font-medium bg-white border border-slate-200 hover:border-slate-300 px-1.5 py-0.5 rounded text-slate-700"
                            >
                              <Printer className="h-2.5 w-2.5 text-emerald-600" />
                              Box {idx + 1} PDF
                            </a>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
                {jobNumber && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Pickup Job #</span>
                    <span className="font-mono text-slate-800">{jobNumber}</span>
                  </div>
                )}
                {pickupPending && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 space-y-2">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Consignment booked, driver pickup pending</p>
                        <p className="text-[11px] text-amber-800">
                          {pickupWarning || "Automatic pickup booking did not complete. Retry pickup scheduling below without recreating the label."}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleRetryPickup}
                      disabled={retryingPickup}
                      className="h-7 text-xs border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                    >
                      {retryingPickup ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                      {retryingPickup ? "Scheduling Pickup…" : "Retry Schedule Pickup"}
                    </Button>
                  </div>
                )}
                {courierStatusInfo?.events && courierStatusInfo.events.length > 0 && (
                  <div className="border-t border-slate-200/60 pt-2 mt-1 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                      <span>Latest Courier Scan</span>
                      {courierStatusInfo.deliveryETA && (
                        <span className="text-muted-foreground">ETA: {courierStatusInfo.deliveryETA}</span>
                      )}
                    </div>
                    {courierStatusInfo.events.slice(0, 3).map((ev, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 text-[11px] text-slate-600">
                        <span>{ev.description}</span>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">{ev.date}</span>
                      </div>
                    ))}
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
                  className="w-full flex items-center justify-center gap-1.5 text-xs bg-white text-slate-900 border-slate-300 hover:bg-slate-50 font-semibold"
                  asChild
                >
                  <a
                    href={`/admin/orders/${orderId}/label`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer className="h-3.5 w-3.5 text-emerald-600" />
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
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <PackageCheck className="h-4 w-4 text-primary shrink-0" />
                    Packaging: {order?.packageName || "Standard Box"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {totalBoxCount > 1 && (
                      <Badge variant="outline" className="text-[10px] text-emerald-800 bg-emerald-50 border-emerald-300">
                        {totalBoxCount} Boxes
                      </Badge>
                    )}
                    {order?.packageOverride && (
                      <Badge variant="outline" className="text-[10px] text-amber-800 bg-amber-50 border-amber-300">
                        Custom Override
                      </Badge>
                    )}
                  </div>
                </div>

                {parsedBoxes.length > 1 || totalBoxCount > 1 ? (
                  <div className="space-y-1 pt-1 border-t border-slate-200/60">
                    {parsedBoxes.map((box, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-[11px] text-slate-700 font-mono">
                        <span className="font-sans truncate text-slate-800">
                          {box.quantity}× {box.label}
                        </span>
                        <span className="shrink-0">
                          {box.length}×{box.width}×{box.height} cm · {box.weight.toFixed(2)} kg
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2 text-slate-600 text-xs pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {totalBoxCount > 1 ? "First Box (L×W×H):" : "Dimensions (L×W×H):"}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {firstBox.length} × {firstBox.width} × {firstBox.height} cm
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {totalBoxCount > 1 ? "Total Gross Weight:" : "Gross Weight:"}
                    </span>
                    <span className="font-semibold text-slate-900">{parsedWeight.toFixed(2)} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Volumetric (Cubic):</span>
                    <span className="font-mono text-slate-700">{cubicWeight.toFixed(2)} kg</span>
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
                  Delivery Instructions (Optional)
                </Label>
                <Input
                  id="specialInstructions"
                  value={specialInstructions}
                  maxLength={140}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. Authority to leave if safe"
                  className="text-xs h-8"
                />
                <p className="text-[10px] text-muted-foreground">
                  {specialInstructions.length}/140 chars (first 15 chars also used for driver pickup note)
                </p>
              </div>

              {(createState === "CP_UNKNOWN" || createState === "UNKNOWN") && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2 text-xs text-amber-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    Uncertain Booking Outcome — Reconcile Existing Consignment
                  </p>
                  <p className="text-[11px] text-amber-800">
                    The previous request timed out after contacting Couriers Please. Check your Couriers Please portal and enter the consignment code below to attach it without double-booking:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={knownConsignmentInput}
                      onChange={(e) => setKnownConsignmentInput(e.target.value)}
                      placeholder="e.g. CPC..."
                      className="h-8 text-xs font-mono bg-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleReconcileConsignment}
                      disabled={reconciling || knownConsignmentInput.trim().length < 3}
                      className="h-8 text-xs shrink-0"
                    >
                      {reconciling ? "Attaching…" : "Attach"}
                    </Button>
                  </div>
                </div>
              )}

              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all text-xs h-9"
                onClick={handleOpenBookingModal}
                disabled={booking || loading || createState === "CP_UNKNOWN" || createState === "UNKNOWN"}
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
        <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Truck className="h-5 w-5 text-emerald-600" />
              Confirm Package Dimensions & Weight
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Each configured box ({totalBoxCount} {totalBoxCount === 1 ? "box" : "boxes"} total) will be sent directly to Couriers Please (native multi-parcel consignment when supported, or separate consignments per box automatically if required). Verify box dimensions and weights below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {modalError && (
              <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                {modalError}
              </div>
            )}

            {/* Separate Boxes List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-slate-500" />
                  Courier Parcel Boxes ({totalBoxCount} {totalBoxCount === 1 ? "box" : "boxes"})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setBoxesState((prev) => [
                      ...prev,
                      {
                        label: `Box ${prev.length + 1}`,
                        quantity: "1",
                        length: "",
                        width: "",
                        height: "",
                        weight: "",
                      },
                    ])
                  }
                  className="h-7 text-[11px]"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Another Packaging
                </Button>
              </div>

              {boxesState.map((box, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700 text-[11px]">Box {idx + 1}</span>
                    {boxesState.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBoxesState((prev) => prev.filter((_, i) => i !== idx))}
                        className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-[11px] text-muted-foreground">Description / Box Name</Label>
                      <Input
                        value={box.label}
                        onChange={(e) => updateBoxRow(idx, "label", e.target.value)}
                        placeholder={`Box ${idx + 1}`}
                        className="mt-1 h-8 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={box.quantity}
                        onChange={(e) => updateBoxRow(idx, "quantity", e.target.value)}
                        placeholder="1"
                        className="mt-1 h-8 text-xs font-mono bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Length (cm)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.1"
                        max="300"
                        placeholder="cm"
                        value={box.length}
                        onChange={(e) => updateBoxRow(idx, "length", e.target.value)}
                        className="mt-1 h-8 text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Width (cm)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.1"
                        max="300"
                        placeholder="cm"
                        value={box.width}
                        onChange={(e) => updateBoxRow(idx, "width", e.target.value)}
                        className="mt-1 h-8 text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Height (cm)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.1"
                        max="300"
                        placeholder="cm"
                        value={box.height}
                        onChange={(e) => updateBoxRow(idx, "height", e.target.value)}
                        className="mt-1 h-8 text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Weight (kg)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.1"
                        max="100"
                        placeholder="kg"
                        value={box.weight}
                        onChange={(e) => updateBoxRow(idx, "weight", e.target.value)}
                        className="mt-1 h-8 text-xs font-mono bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calculated Metrics Summary */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-slate-500" />
                  Total Charged Billable Weight ({totalBoxCount} {totalBoxCount === 1 ? "box" : "boxes"}):
                </span>
                <span className="font-bold text-emerald-700 font-mono">
                  {billableWeight.toFixed(2)} kg
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Sum across boxes:</span>
                <span>Actual {parsedWeight.toFixed(2)} kg · Volumetric {cubicWeight.toFixed(2)} kg</span>
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
                Delivery Instructions (Max 140 characters)
              </Label>
              <Input
                id="modalSpecialInstructions"
                value={specialInstructions}
                maxLength={140}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Authority to leave if safe"
                className="text-xs h-8"
              />
              <p className="text-[10px] text-muted-foreground flex justify-between">
                <span>Couriers Please delivery rule</span>
                <span className={specialInstructions.length >= 130 ? "text-amber-600 font-semibold" : ""}>
                  {specialInstructions.length}/140 chars
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
