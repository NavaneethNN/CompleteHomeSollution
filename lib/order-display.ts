export function orderContentsLabel(order: { items: readonly unknown[]; membershipAmount: number }) {
  const count = order.items.length;
  const products = `${count} ${count === 1 ? "item" : "items"}`;
  return order.membershipAmount > 0
    ? count === 0 ? "1 membership" : `${products} + membership`
    : products;
}

export interface EffectiveOrderStatus {
  status: string;
  label: string;
  badgeStyle: string;
  isPickup: boolean;
  isAppointmentScheduled: boolean;
  isReadyForPickup: boolean;
  isPickedUp: boolean;
  appointmentFormatted: string | null;
}

/**
 * Returns formatted appointment date and time for store pickup orders.
 * e.g., "Sat, 8 Nov at 10:30 AM" or "8 Nov 2026"
 */
export function formatAppointmentDate(
  date?: Date | string | null,
  time?: string | null
): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const dateStr = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return time ? `${dateStr} · ${time}` : dateStr;
}

/**
 * Resolves the customer-facing effective order status, taking into account
 * store pickup appointment and collection stages.
 */
export function getEffectiveOrderStatus(order: {
  status: string;
  fulfillmentType?: string | null;
  pickupStatus?: string | null;
  pickupAppointmentDate?: Date | string | null;
  pickupAppointmentTime?: string | null;
}): EffectiveOrderStatus {
  const isPickup = order.fulfillmentType === "STORE_PICKUP";
  const appointmentFormatted = formatAppointmentDate(
    order.pickupAppointmentDate,
    order.pickupAppointmentTime
  );

  const isAppointmentScheduled = Boolean(
    isPickup && (order.pickupStatus === "SCHEDULED" || order.pickupAppointmentDate)
  );
  const isReadyForPickup = Boolean(isPickup && order.pickupStatus === "READY_FOR_PICKUP");
  const isPickedUp = Boolean(
    isPickup && (order.status === "DELIVERED" || order.pickupStatus === "PICKED_UP")
  );

  // Terminal or special statuses
  if (order.status === "CANCELLED") {
    return {
      status: "CANCELLED",
      label: "Cancelled",
      badgeStyle: "bg-stone-100 text-stone-700 border-stone-200",
      isPickup,
      isAppointmentScheduled: false,
      isReadyForPickup: false,
      isPickedUp: false,
      appointmentFormatted,
    };
  }

  if (order.status === "REFUNDED") {
    return {
      status: "REFUNDED",
      label: "Refunded",
      badgeStyle: "bg-stone-100 text-stone-700 border-stone-200",
      isPickup,
      isAppointmentScheduled: false,
      isReadyForPickup: false,
      isPickedUp: false,
      appointmentFormatted,
    };
  }

  if (order.status === "PENDING") {
    return {
      status: "PENDING",
      label: "Payment Pending",
      badgeStyle: "bg-stone-100 text-stone-700 border-stone-200",
      isPickup,
      isAppointmentScheduled: false,
      isReadyForPickup: false,
      isPickedUp: false,
      appointmentFormatted,
    };
  }

  // Store Pickup specific statuses
  if (isPickup) {
    if (isPickedUp) {
      return {
        status: "PICKED_UP",
        label: "Picked Up & Completed",
        badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-200",
        isPickup,
        isAppointmentScheduled,
        isReadyForPickup: false,
        isPickedUp: true,
        appointmentFormatted,
      };
    }

    if (isReadyForPickup) {
      return {
        status: "READY_FOR_PICKUP",
        label: "Ready for Pickup",
        badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-200",
        isPickup,
        isAppointmentScheduled,
        isReadyForPickup: true,
        isPickedUp: false,
        appointmentFormatted,
      };
    }

    if (isAppointmentScheduled) {
      return {
        status: "SCHEDULED",
        label: "Pickup Scheduled",
        badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
        isPickup,
        isAppointmentScheduled: true,
        isReadyForPickup: false,
        isPickedUp: false,
        appointmentFormatted,
      };
    }

    if (order.status === "PROCESSING") {
      return {
        status: "PROCESSING",
        label: "Preparing in Store",
        badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
        isPickup,
        isAppointmentScheduled: false,
        isReadyForPickup: false,
        isPickedUp: false,
        appointmentFormatted,
      };
    }

    // Default for paid/confirmed store pickup awaiting appointment scheduling
    return {
      status: "CONFIRMED",
      label: "Order Confirmed",
      badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
      isPickup,
      isAppointmentScheduled: false,
      isReadyForPickup: false,
      isPickedUp: false,
      appointmentFormatted,
    };
  }

  // Standard delivery statuses
  switch (order.status) {
    case "PAID":
    case "CONFIRMED":
      return {
        status: order.status,
        label: "Confirmed",
        badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
        isPickup: false,
        isAppointmentScheduled: false,
        isReadyForPickup: false,
        isPickedUp: false,
        appointmentFormatted: null,
      };
    case "PROCESSING":
      return {
        status: "PROCESSING",
        label: "Processing",
        badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
        isPickup: false,
        isAppointmentScheduled: false,
        isReadyForPickup: false,
        isPickedUp: false,
        appointmentFormatted: null,
      };
    case "SHIPPED":
      return {
        status: "SHIPPED",
        label: "Shipped",
        badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
        isPickup: false,
        isAppointmentScheduled: false,
        isReadyForPickup: false,
        isPickedUp: false,
        appointmentFormatted: null,
      };
    case "OUT_FOR_DELIVERY":
      return {
        status: "OUT_FOR_DELIVERY",
        label: "Out for Delivery",
        badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
        isPickup: false,
        isAppointmentScheduled: false,
        isReadyForPickup: false,
        isPickedUp: false,
        appointmentFormatted: null,
      };
    case "DELIVERED":
      return {
        status: "DELIVERED",
        label: "Delivered",
        badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-200",
        isPickup: false,
        isAppointmentScheduled: false,
        isReadyForPickup: false,
        isPickedUp: false,
        appointmentFormatted: null,
      };
    default:
      return {
        status: order.status,
        label: order.status,
        badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
        isPickup: false,
        isAppointmentScheduled: false,
        isReadyForPickup: false,
        isPickedUp: false,
        appointmentFormatted: null,
      };
  }
}
