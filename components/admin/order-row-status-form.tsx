"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "PAID",             label: "Paid" },
  { value: "PROCESSING",       label: "Processing" },
  { value: "SHIPPED",          label: "Shipped" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED",        label: "Delivered" },
  { value: "CANCELLED",        label: "Cancelled" },
  { value: "REFUNDED",         label: "Refunded" },
];

interface OrderRowStatusFormProps {
  orderId: string;
  currentStatus: string;
}

export function OrderRowStatusForm({ orderId, currentStatus }: OrderRowStatusFormProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    if (selectedStatus === currentStatus) {
      toast.info("No status change selected.");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: selectedStatus }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update status");
      }

      toast.success(`Status updated to ${STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
        disabled={isUpdating}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50 cursor-pointer"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleUpdate}
        disabled={isUpdating}
        className="h-8 px-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
      >
        {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Update"}
      </button>
    </div>
  );
}
