import { sendEmail } from "./brevo";

interface OrderStatusNotificationData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  newStatus: string;
  previousStatus: string;
  trackingNumber?: string;
  carrier?: string;
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

const ORDER_STATUS_MESSAGES: Record<string, { subject: string; title: string; message: string; color: string }> = {
  PENDING: {
    subject: "Order Received - #{orderNumber}",
    title: "Order Received",
    message: "Thank you for your order! We've received your order and are preparing it for processing.",
    color: "#f59e0b",
  },
  PAID: {
    subject: "Payment Confirmed - #{orderNumber}",
    title: "Payment Confirmed",
    message: "Great news! Your payment has been successfully processed and your order is now confirmed.",
    color: "#3b82f6",
  },
  CONFIRMED: {
    subject: "Order Confirmed - #{orderNumber}",
    title: "Order Confirmed",
    message: "Your order has been confirmed and is now being prepared for shipment.",
    color: "#14b8a6",
  },
  PROCESSING: {
    subject: "Order Processing - #{orderNumber}",
    title: "Order Processing",
    message: "Your order is currently being processed by our team. We're preparing your items for shipment.",
    color: "#6366f1",
  },
  SHIPPED: {
    subject: "Order Shipped - #{orderNumber}",
    title: "Order Shipped",
    message: "Your order has been shipped! You can track your package using the tracking information below.",
    color: "#8b5cf6",
  },
  OUT_FOR_DELIVERY: {
    subject: "Out for Delivery - #{orderNumber}",
    title: "Out for Delivery",
    message: "Your order is out for delivery and will arrive soon! Keep an eye out for the delivery.",
    color: "#a855f7",
  },
  DELIVERED: {
    subject: "Order Delivered - #{orderNumber}",
    title: "Order Delivered",
    message: "Your order has been successfully delivered! Thank you for shopping with Complete Home Solution.",
    color: "#10b981",
  },
  CANCELLED: {
    subject: "Order Cancelled - #{orderNumber}",
    title: "Order Cancelled",
    message: "Your order has been cancelled. If you have any questions, please contact our support team.",
    color: "#ef4444",
  },
  REFUNDED: {
    subject: "Order Refunded - #{orderNumber}",
    title: "Order Refunded",
    message: "Your order has been refunded. The refund should appear in your account within 3-5 business days.",
    color: "#6b7280",
  },
};

/** S-6: Escape user-controlled strings before embedding in HTML to prevent injection. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function sendOrderStatusNotification(data: OrderStatusNotificationData) {
  try {
    const statusConfig = ORDER_STATUS_MESSAGES[data.newStatus] || ORDER_STATUS_MESSAGES.PENDING;

    // Format currency
    const currencyFormatter = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    });

    // S-6: Escape all user-controlled values before interpolating into HTML
    const safeOrderNumber = escapeHtml(data.orderNumber);
    const safeCustomerName = escapeHtml(data.customerName);
    const safeCarrier = data.carrier ? escapeHtml(data.carrier) : null;
    const safeTrackingNumber = data.trackingNumber ? escapeHtml(data.trackingNumber) : null;

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
      // price is a number — no escaping needed
      price: item.price,
    }));

    // Build email HTML using only escaped values
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(statusConfig.subject.replace("#{orderNumber}", safeOrderNumber))}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .status-badge { display: inline-block; background: ${statusConfig.color}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 15px 0; }
          .content { background: #f9f9f9; padding: 30px; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .order-item { border-bottom: 1px solid #eee; padding: 15px 0; }
          .order-item:last-child { border-bottom: none; }
          .tracking-info { background: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusConfig.color}; }
          .footer { background: #ecf0f1; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #7f8c8d; }
          .total-row { font-weight: bold; font-size: 18px; color: #2c3e50; border-top: 2px solid #3498db; padding-top: 15px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Complete Home Solution</h1>
        </div>

        <div class="content">
          <h2 style="color: #2c3e50; margin-bottom: 10px;">Hi ${safeCustomerName},</h2>
          <h3 style="color: #2c3e50; margin-bottom: 10px;">${escapeHtml(statusConfig.title)}</h3>
          <div class="status-badge">${escapeHtml(statusConfig.title)}</div>
          <p style="color: #34495e; margin-bottom: 20px;">${escapeHtml(statusConfig.message)}</p>

          <div class="order-details">
            <h3 style="color: #2c3e50; margin-bottom: 15px;">Order Details</h3>
            <p><strong>Order Number:</strong> ${safeOrderNumber}</p>
            <p><strong>Status:</strong> ${escapeHtml(statusConfig.title)}</p>

            ${safeTrackingNumber && safeCarrier ? `
              <div class="tracking-info">
                <h4 style="color: #2c3e50; margin-bottom: 10px;">Tracking Information</h4>
                <p><strong>Carrier:</strong> ${safeCarrier}</p>
                <p><strong>Tracking Number:</strong> ${safeTrackingNumber}</p>
              </div>
            ` : ""}

            <h4 style="color: #2c3e50; margin: 20px 0 15px 0;">Order Items</h4>
            ${safeItems.map((item) => `
              <div class="order-item">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <p style="font-weight: bold; margin: 0;">${item.productName}</p>
                    <p style="color: #7f8c8d; margin: 5px 0;">Quantity: ${item.quantity}</p>
                  </div>
                  <p style="font-weight: bold; color: #2c3e50;">${currencyFormatter.format(item.price)}</p>
                </div>
              </div>
            `).join("")}

            <div class="total-row">
              <div style="display: flex; justify-content: space-between;">
                <span>Total:</span>
                <span>${currencyFormatter.format(data.total)}</span>
              </div>
            </div>
          </div>

          ${safeAddress ? `
            <div style="background: white; padding: 20px; border-radius: 8px;">
              <h4 style="color: #2c3e50; margin-bottom: 15px;">Shipping Address</h4>
              <p style="margin: 0;">${safeAddress.name}</p>
              <p style="margin: 0;">${safeAddress.line1}</p>
              ${safeAddress.line2 ? `<p style="margin: 0;">${safeAddress.line2}</p>` : ""}
              <p style="margin: 0;">${safeAddress.suburb}, ${safeAddress.state} ${safeAddress.postcode}</p>
              <p style="margin: 0;">${safeAddress.country}</p>
            </div>
          ` : ""}
        </div>

        <div class="footer">
          <p>Thank you for choosing Complete Home Solution!</p>
          <p>Need help? Contact us at support@completehomesollution.com.au</p>
          <p>&copy; 2024 Complete Home Solution. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: [{ email: data.customerEmail, name: data.customerName }],
      subject: statusConfig.subject.replace("#{orderNumber}", data.orderNumber),
      htmlContent: emailHtml,
    });

    console.log(`Order status notification sent to ${data.customerEmail} for order ${data.orderNumber}`);

    return { success: true };
  } catch (error) {
    console.error("Error sending order status notification:", error);
    throw error;
  }
}
