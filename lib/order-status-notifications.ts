import { sendEmail } from "./brevo";
import { renderStandardEmail, renderCard, escapeHtml } from "./email-template";
import { createGuestOrderToken } from "./order-access";

interface OrderStatusNotificationData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  newStatus: string;
  previousStatus: string;
  idempotencyKey?: string;
  trackingNumber?: string;
  carrier?: string;
  fulfillmentType?: string;
  pickupStatus?: string;
  pickupAppointmentDate?: Date | string | null;
  pickupAppointmentTime?: string | null;
  pickupNotes?: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string;
    suburb: string;
    state: string;
    postcode: string;
    country: string;
  };
}

const STORE_PICKUP_MESSAGES: Record<
  string,
  { subject: string; title: string; message: string; badgeType: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  PENDING: {
    subject: "Order Received (Store Pickup) - #{orderNumber}",
    title: "Order Received",
    message: "Thank you for your order! We've received your store pickup order and are awaiting payment confirmation.",
    badgeType: "warning",
  },
  PAID: {
    subject: "Payment Confirmed (Store Pickup) - #{orderNumber}",
    title: "Payment Confirmed",
    message: "Great news! Your payment has been received. Our showroom team will contact you to coordinate your pickup appointment.",
    badgeType: "info",
  },
  CONFIRMED: {
    subject: "Order Confirmed (Store Pickup) - #{orderNumber}",
    title: "Order Confirmed",
    message: "Your store pickup order has been confirmed! Our showroom team is preparing your items at Golden Grove.",
    badgeType: "info",
  },
  PROCESSING: {
    subject: "Preparing for Showroom Collection - #{orderNumber}",
    title: "Preparing for Pickup",
    message: "Your items are being prepared at our Golden Grove showroom. Please check your collection appointment details below.",
    badgeType: "info",
  },
  DELIVERED: {
    subject: "Order Collected - #{orderNumber}",
    title: "Order Picked Up & Completed",
    message: "Thank you for visiting our showroom! Your order has been collected and completed.",
    badgeType: "success",
  },
  CANCELLED: {
    subject: "Pickup Order Cancelled - #{orderNumber}",
    title: "Order Cancelled",
    message: "Your store pickup order has been cancelled. If you have questions, please contact our showroom team.",
    badgeType: "danger",
  },
  REFUNDED: {
    subject: "Pickup Order Refunded - #{orderNumber}",
    title: "Order Refunded",
    message: "Your store pickup order has been refunded. The refund will appear in your account within 3-5 business days.",
    badgeType: "neutral",
  },
};

const ORDER_STATUS_MESSAGES: Record<
  string,
  { subject: string; title: string; message: string; badgeType: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  PENDING: {
    subject: "Order Received - #{orderNumber}",
    title: "Order Received",
    message: "Thank you for your order! We've received your order and are preparing it for processing.",
    badgeType: "warning",
  },
  PAID: {
    subject: "Payment Confirmed - #{orderNumber}",
    title: "Payment Confirmed",
    message: "Great news! Your payment has been successfully processed and your order is now confirmed.",
    badgeType: "info",
  },
  CONFIRMED: {
    subject: "Order Confirmed - #{orderNumber}",
    title: "Order Confirmed",
    message: "Your order has been confirmed and is now being prepared for shipment.",
    badgeType: "info",
  },
  PROCESSING: {
    subject: "Order Processing - #{orderNumber}",
    title: "Order Processing",
    message: "Your order is currently being processed by our team. We're preparing your items for shipment.",
    badgeType: "info",
  },
  SHIPPED: {
    subject: "Order Shipped - #{orderNumber}",
    title: "Order Shipped",
    message: "Your order has been shipped! You can track your package using the tracking information below.",
    badgeType: "info",
  },
  OUT_FOR_DELIVERY: {
    subject: "Out for Delivery - #{orderNumber}",
    title: "Out for Delivery",
    message: "Your order is out for delivery and will arrive soon! Keep an eye out for the delivery.",
    badgeType: "info",
  },
  DELIVERED: {
    subject: "Order Delivered - #{orderNumber}",
    title: "Order Delivered",
    message: "Your order has been successfully delivered! Thank you for shopping with Complete Home Solution.",
    badgeType: "success",
  },
  CANCELLED: {
    subject: "Order Cancelled - #{orderNumber}",
    title: "Order Cancelled",
    message: "Your order has been cancelled. If you have any questions, please contact our support team.",
    badgeType: "danger",
  },
  REFUNDED: {
    subject: "Order Refunded - #{orderNumber}",
    title: "Order Refunded",
    message: "Your order has been refunded. The refund should appear in your account within 3-5 business days.",
    badgeType: "neutral",
  },
};

export async function sendOrderStatusNotification(data: OrderStatusNotificationData) {
  try {
    const isPickup = data.fulfillmentType === "STORE_PICKUP";
    const statusMap = isPickup ? STORE_PICKUP_MESSAGES : ORDER_STATUS_MESSAGES;
    const statusConfig = statusMap[data.newStatus] || statusMap.PENDING || ORDER_STATUS_MESSAGES.PENDING;

    const currencyFormatter = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    });

    const safeOrderNumber = escapeHtml(data.orderNumber);
    const safeCustomerName = escapeHtml(data.customerName);
    const safeCarrier = data.carrier ? escapeHtml(data.carrier) : null;
    const safeTrackingNumber = data.trackingNumber ? escapeHtml(data.trackingNumber) : null;
    const formattedApptDate = data.pickupAppointmentDate
      ? new Date(data.pickupAppointmentDate).toLocaleDateString("en-AU", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
    const safeApptTime = data.pickupAppointmentTime ? escapeHtml(data.pickupAppointmentTime) : null;
    const safePickupNotes = data.pickupNotes ? escapeHtml(data.pickupNotes) : null;

    const safeAddress = data.shippingAddress
      ? {
          name: escapeHtml(data.shippingAddress.name),
          line1: escapeHtml(data.shippingAddress.line1),
          line2: data.shippingAddress.line2 ? escapeHtml(data.shippingAddress.line2) : null,
          suburb: escapeHtml(data.shippingAddress.suburb),
          state: escapeHtml(data.shippingAddress.state),
          postcode: escapeHtml(data.shippingAddress.postcode),
          country: escapeHtml(data.shippingAddress.country),
        }
      : null;

    const safeItems = data.items.map((item) => ({
      productName: escapeHtml(item.productName),
      quantity: item.quantity,
      price: item.price,
    }));

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://completehomesollution.com.au").replace(/\/$/, "");
    const guestToken = createGuestOrderToken(data.orderId, data.customerEmail);
    const orderUrl = `${appUrl}/order-confirmation/${encodeURIComponent(data.orderId)}?token=${guestToken}`;

    // Build items table
    const itemsTableHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <th style="padding:8px 0;font-size:12px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;">Item</th>
            <th style="padding:8px 0;font-size:12px;font-weight:700;color:#64748b;text-align:center;text-transform:uppercase;">Qty</th>
            <th style="padding:8px 0;font-size:12px;font-weight:700;color:#64748b;text-align:right;text-transform:uppercase;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${safeItems
            .map(
              (item) => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 0;font-weight:600;color:#1e293b;">${item.productName}</td>
              <td style="padding:10px 0;color:#64748b;text-align:center;">${item.quantity}</td>
              <td style="padding:10px 0;color:#1e293b;text-align:right;font-weight:600;">${currencyFormatter.format(item.price * item.quantity)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      <div style="margin-top:14px;text-align:right;">
        <span style="font-size:16px;font-weight:800;color:#1a2e5a;border-top:2px solid #1a2e5a;padding-top:6px;display:inline-block;">
          Total: ${currencyFormatter.format(data.total)}
        </span>
      </div>
    `;

    // Tracking card
    const trackingHtml = safeTrackingNumber
      ? renderCard(
          `
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          ${safeCarrier ? `<tr><td style="padding:4px 0;color:#64748b;width:35%;">Carrier:</td><td style="padding:4px 0;font-weight:700;">${safeCarrier}</td></tr>` : ""}
          <tr><td style="padding:4px 0;color:#64748b;width:35%;">Tracking Number:</td><td style="padding:4px 0;font-weight:700;color:#1a2e5a;">${safeTrackingNumber}</td></tr>
        </table>
      `,
          { title: "Tracking Information", bg: "#eff6ff", border: "#bfdbfe" }
        )
      : "";

    // Showroom collection card
    const pickupHtml = isPickup
      ? renderCard(
          `
        <p style="margin:0;font-weight:700;color:#1e293b;">Complete Home Sollution Showroom</p>
        <p style="margin:4px 0 0;color:#475569;font-size:13px;">18 Edison Drive, Golden Grove SA 5125</p>
        <p style="margin:4px 0 0;color:#475569;font-size:13px;">Trading Hours: Mon-Fri: 9:00 AM – 5:00 PM | Sat: 9:00 AM – 4:00 PM</p>
        <p style="margin:4px 0 0;color:#475569;font-size:13px;">Phone: +61 401 682 910</p>
        ${
          formattedApptDate
            ? `
          <div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
            <strong style="color:#0f172a;font-size:13px;">Scheduled Pickup Appointment:</strong>
            <p style="margin:4px 0 0;font-size:13px;color:#334155;">
              ${formattedApptDate} ${safeApptTime ? `at ${safeApptTime}` : ""}
            </p>
          </div>
        `
            : `
          <div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#475569;">
              Our showroom team will contact you shortly to coordinate an agreed collection date and time.
            </p>
          </div>
        `
        }
        ${
          safePickupNotes
            ? `
          <p style="margin:8px 0 0;font-size:12px;color:#475569;">
            <strong>Special Instructions:</strong> ${safePickupNotes}
          </p>
        `
            : ""
        }
        <p style="margin:12px 0 0;font-size:11px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:8px;">
          Please bring photo ID and your Order Number: <strong>#${safeOrderNumber}</strong>.
        </p>
      `,
          { title: "Showroom Collection Details", bg: "#f8fafc", border: "#e2e8f0" }
        )
      : "";

    // Address card (for delivery)
    const addressHtml =
      !isPickup && safeAddress
        ? renderCard(
            `
          <p style="margin:0;font-weight:700;color:#1e293b;">${safeAddress.name}</p>
          <p style="margin:4px 0 0;color:#475569;font-size:13px;">
            ${safeAddress.line1}${safeAddress.line2 ? `, ${safeAddress.line2}` : ""}<br/>
            ${safeAddress.suburb}, ${safeAddress.state} ${safeAddress.postcode}<br/>
            ${safeAddress.country}
          </p>
        `,
            { title: "Shipping Address", bg: "#f8fafc" }
          )
        : "";

    const bodyHtml = `
      <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
        ${escapeHtml(statusConfig.message)}
      </p>

      ${trackingHtml}
      ${pickupHtml}
      ${addressHtml}

      ${renderCard(itemsTableHtml, { title: "Order Summary", bg: "#ffffff" })}
    `;

    const emailSubject = statusConfig.subject.replace("#{orderNumber}", data.orderNumber);

    const emailHtml = renderStandardEmail({
      title: emailSubject,
      badge: {
        text: statusConfig.title,
        subtitle: `Order #${safeOrderNumber}`,
        type: statusConfig.badgeType,
      },
      greeting: `Hi ${safeCustomerName},`,
      bodyHtml,
      cta: {
        text: "View Order Details",
        url: orderUrl,
      },
    });

    await sendEmail({
      ...(data.idempotencyKey ? { headers: { idempotencyKey: data.idempotencyKey } } : {}),
      to: [{ email: data.customerEmail, name: data.customerName }],
      subject: emailSubject,
      htmlContent: emailHtml,
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending order status notification:", error);
    throw error;
  }
}
