"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

type OrderShipmentData = {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippingServiceCode: string | null;
  ship123OrderNo: string | null;
  ship123LabelUrl: string | null;
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
  const [isBooked, setIsBooked] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("Safe drop");
  const [jobNumber, setJobNumber] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string>(currentStatus);

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
        if (data.order?.status) {
          setOrderStatus(data.order.status);
        }
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

  async function handleReadyToShip() {
    if (booking) return;
    setBooking(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/ready-to-ship`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialInstructions: specialInstructions.trim() || undefined,
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
              status: "SHIPPED",
            }
          : prev
      );

      toast.success("Order booked with Couriers Please! Pickup arranged.");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to arrange shipment with Couriers Please";
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
              Clicking <strong>&ldquo;Ready to Ship&rdquo;</strong> sends delivery details to Couriers Please,
              creates the consignment, books driver pickup at your Golden Grove warehouse, and retrieves your printable label.
            </p>

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
              <p className="text-[10px] text-muted-foreground">Max 15 characters (Couriers Please rule)</p>
            </div>

            <Button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all text-xs h-9"
              onClick={handleReadyToShip}
              disabled={booking || loading}
            >
              {booking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Booking Pickup with Couriers Please…
                </>
              ) : (
                <>
                  <Truck className="mr-2 h-4 w-4" />
                  Ready to Ship (Book Couriers Please)
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
