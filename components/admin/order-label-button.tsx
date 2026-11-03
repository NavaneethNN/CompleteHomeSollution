"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { ShippingLabelDialog } from "./shipping-label-dialog";

interface OrderLabelButtonProps {
  orderId: string;
  orderNumber?: string;
  fulfillmentType?: string | null;
  status?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

export function OrderLabelButton({
  orderId,
  orderNumber,
  fulfillmentType,
  status,
  variant = "outline",
  size = "sm",
  className,
  label,
}: OrderLabelButtonProps) {
  const [open, setOpen] = useState(false);

  const defaultLabel =
    label ||
    (fulfillmentType === "STORE_PICKUP"
      ? "Pickup Docket"
      : fulfillmentType === "MANUAL_DELIVERY"
      ? "Delivery Docket"
      : "Print Label");

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={`Generate & Print Label for #${orderNumber || orderId.slice(-8).toUpperCase()}`}
        className={className}
      >
        <Printer className="h-3.5 w-3.5 text-blue-600 shrink-0 mr-1.5" />
        <span>{defaultLabel}</span>
      </Button>

      {open && (
        <ShippingLabelDialog
          orderId={orderId}
          orderNumber={orderNumber}
          fulfillmentType={fulfillmentType}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
