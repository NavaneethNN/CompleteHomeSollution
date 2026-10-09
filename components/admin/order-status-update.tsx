"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_FULFILMENT_STATUSES, ORDER_TRANSITIONS } from "@/lib/order-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Package,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING:          { label: "Pending",          icon: Clock,            variant: "outline" },
  PAID:             { label: "Paid",             icon: CheckCircle2,   variant: "secondary" },
  CONFIRMED:        { label: "Confirmed",        icon: CheckCircle2,   variant: "secondary" },
  PROCESSING:       { label: "Processing",       icon: Package,        variant: "default" },
  SHIPPED:          { label: "Shipped",          icon: Truck,          variant: "default" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", icon: Truck,          variant: "default" },
  DELIVERED:        { label: "Delivered",        icon: CheckCircle2,   variant: "secondary" },
  CANCELLED:        { label: "Cancelled",        icon: XCircle,        variant: "destructive" },
  REFUNDED:         { label: "Refunded",         icon: AlertCircle,    variant: "outline" },
};

interface OrderStatusUpdateProps {
  orderId: string;
  currentStatus: string;
  currentTrackingNumber?: string | null;
  currentCarrier?: string | null;
}

export function OrderStatusUpdate({
  orderId,
  currentStatus,
  currentTrackingNumber,
  currentCarrier,
}: OrderStatusUpdateProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber ?? "");
  const [carrier, setCarrier] = useState(currentCarrier ?? "");

  const showTrackingFields = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(selectedStatus);
  const hasChanged = selectedStatus !== currentStatus
    || trackingNumber !== (currentTrackingNumber ?? "")
    || carrier !== (currentCarrier ?? "");
  const currentConfig = ORDER_STATUS_CONFIG[currentStatus] ?? ORDER_STATUS_CONFIG.PAID;

  const handleUpdate = async () => {
    if (!hasChanged) {
      toast.info("No changes to save.");
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: selectedStatus,
          trackingNumber: trackingNumber.trim() || null,
          carrier: carrier.trim() || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update order status");
      }

      toast.success(`Order status updated to ${ORDER_STATUS_CONFIG[selectedStatus]?.label ?? selectedStatus}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Update Order Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Current Status</p>
          <Badge variant={currentConfig.variant} className="flex items-center gap-1 w-fit">
            <currentConfig.icon className="h-3 w-3" />
            {currentConfig.label}
          </Badge>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <Label htmlFor="order-status-select">Set New Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger id="order-status-select" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ORDER_STATUS_CONFIG).filter(([status]) =>
                  status === currentStatus ||
                  (ADMIN_FULFILMENT_STATUSES as readonly string[]).includes(status) && ORDER_TRANSITIONS[currentStatus]?.includes(status)
                ).map(([status, config]) => (
                  <SelectItem key={status} value={status}>
                    <div className="flex items-center gap-2">
                      <config.icon className="h-4 w-4" />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showTrackingFields && (
            <>
              <div>
                <Label htmlFor="tracking-number">Tracking ID <span className="text-slate-400">(optional)</span></Label>
                <Input
                  id="tracking-number"
                  className="mt-1"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. 1Z999AA10123456784"
                />
              </div>
              <div>
                <Label htmlFor="carrier">Courier <span className="text-slate-400">(optional)</span></Label>
                <Input
                  id="carrier"
                  className="mt-1"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g. Australia Post, FedEx, DHL"
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 active:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUpdating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</>
            ) : (
              "Update Status"
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Customers receive a status email. Add a tracking ID when available so they can follow the parcel with the courier.
        </p>
      </CardContent>
    </Card>
  );
}
