import { createGuestOrderToken } from "@/lib/order-access";
import { renderStandardEmail, renderCard, escapeHtml } from "@/lib/email-template";

const BREVO_API_URL = "https://api.brevo.com/v3";

interface SendEmailParams {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: { email: string; name?: string };
  headers?: Record<string, string>;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: process.env.BREVO_FROM_EMAIL || "noreply@completehomesollution.com.au",
        name: process.env.BREVO_FROM_NAME || "Complete Home Sollution",
      },
      ...params,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (response.status === 400 && params.headers?.idempotencyKey && error?.code === "duplicate_parameter") return;
    console.error("[Brevo] Email delivery failed", { status: response.status, code: error?.code, message: error?.message });
    throw new Error(`Brevo email failed (HTTP ${response.status})`);
  }
}

export async function sendOtpEmail(
  email: string,
  name: string,
  otp: string
): Promise<void> {
  const firstName = escapeHtml(name?.split(" ")[0] || "there");
  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;">
      Use the secure one-time verification code below to sign in to your Complete Home Sollution account. This code expires in <strong>10 minutes</strong>.
    </p>

    ${renderCard(`
      <div style="text-align:center;padding:12px 0;">
        <span style="font-size:32px;letter-spacing:0.35em;font-weight:900;color:#1a2e5a;font-family:monospace;">${escapeHtml(otp)}</span>
      </div>
    `, { title: "Your 6-Digit Login Code", bg: "#f1f5f9" })}

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
      If you did not request this login code, you can safely disregard this email. For security, never share this code with anyone.
    </p>
  `;

  const htmlContent = renderStandardEmail({
    title: "Your login code — Complete Home Sollution",
    badge: { text: "Secure Account Sign-In", type: "info" },
    greeting: `Hi ${firstName},`,
    bodyHtml,
  });

  await sendEmail({
    to: [{ email, name }],
    subject: "Your Complete Home Sollution login code",
    htmlContent,
  });
}

const ADMIN_EMAIL = "info@completehomesollution.com.au";
const ADMIN_NAME  = "Complete Home Sollution";

function buildItemsTable(items: { name: string; quantity: number; price: number }[]): string {
  const rows = items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0ebe5;font-size:14px;color:#1a1a1a;">${escapeHtml(i.name)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0ebe5;font-size:14px;color:#555;text-align:center;">${i.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0ebe5;font-size:14px;color:#1a1a1a;text-align:right;">A$${i.price.toFixed(2)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0ebe5;font-size:14px;font-weight:600;color:#1a1a1a;text-align:right;">A$${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`
    )
    .join("");
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #f0ebe5;border-radius:10px;overflow:hidden;margin-top:8px;">
      <thead>
        <tr style="background:#f7f3ef;">
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#888;text-align:left;text-transform:uppercase;letter-spacing:0.06em;">Product</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#888;text-align:center;text-transform:uppercase;letter-spacing:0.06em;">Qty</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#888;text-align:right;text-transform:uppercase;letter-spacing:0.06em;">Unit Price</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#888;text-align:right;text-transform:uppercase;letter-spacing:0.06em;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export async function sendOrderConfirmationEmail(params: {
  email: string;
  name: string;
  orderId: string;
  total: number;
  items: { name: string; quantity: number; price: number }[];
  address?: {
    name: string;
    line1: string;
    line2?: string | null;
    suburb: string;
    state: string;
    postcode: string;
    country: string;
  } | null;
  customerEmail?: string;
  audience?: "customer" | "admin" | "both";
  idempotencyKey?: string;
}): Promise<void> {
  const shortId = escapeHtml(params.orderId.slice(-8).toUpperCase());
  const firstName = escapeHtml(params.name.split(" ")[0] || "there");
  const itemsTable = buildItemsTable(params.items);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://completehomesollution.com.au").replace(/\/$/, "");

  const addrHtml = params.address
    ? escapeHtml(`${params.address.line1}${params.address.line2 ? ", " + params.address.line2 : ""}, ${params.address.suburb} ${params.address.state} ${params.address.postcode}, ${params.address.country}`)
    : "Not provided";

  // ── Customer email ────────────────────────────────────────────────────────
  const customerBodyHtml = `
    <p style="margin:0 0 20px;color:#334155;">
      Thank you for your order! We've received your payment and our team is getting your items ready.
      You'll receive a notification as soon as your items are dispatched or prepared for pickup.
    </p>

    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Order Items</p>
    ${itemsTable}

    <div style="margin-top:16px;text-align:right;">
      <span style="font-size:18px;font-weight:900;color:#1a2e5a;border-top:2px solid #1a2e5a;padding-top:8px;display:inline-block;">
        Total: A$${params.total.toFixed(2)}
      </span>
    </div>

    ${renderCard(`
      <p style="margin:0;font-weight:700;color:#1e293b;">${escapeHtml(params.address?.name ?? params.name)}</p>
      <p style="margin:4px 0 0;color:#475569;font-size:13px;line-height:1.5;">${addrHtml}</p>
    `, { title: "Delivery / Recipient Address", bg: "#f8fafc" })}
  `;

  const customerHtml = renderStandardEmail({
    title: `Order confirmed — #${shortId}`,
    badge: { text: "Order Confirmed & Paid", subtitle: `Order #${shortId}`, type: "success" },
    greeting: `Hi ${firstName},`,
    bodyHtml: customerBodyHtml,
    cta: {
      text: "View My Order",
      url: `${appUrl}/order-confirmation/${encodeURIComponent(params.orderId)}?token=${createGuestOrderToken(params.orderId, params.email)}`,
    },
  });

  // ── Admin notification email ───────────────────────────────────────────────
  const adminBodyHtml = `
    ${renderCard(`
      <p style="margin:0 0 4px;font-weight:700;color:#1e293b;">${escapeHtml(params.name)}</p>
      ${params.customerEmail ? `<p style="margin:0 0 6px;color:#64748b;font-size:13px;">${escapeHtml(params.customerEmail)}</p>` : ""}
      <p style="margin:8px 0 2px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;">Delivery Address</p>
      <p style="margin:0;color:#334155;font-size:13px;line-height:1.5;">${addrHtml}</p>
    `, { title: "Customer Information", bg: "#f8fafc" })}

    <p style="margin:16px 0 8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Items Ordered</p>
    ${itemsTable}

    <div style="margin-top:16px;text-align:right;">
      <span style="font-size:18px;font-weight:900;color:#1a2e5a;border-top:2px solid #1a2e5a;padding-top:8px;display:inline-block;">
        Total: A$${params.total.toFixed(2)}
      </span>
    </div>
  `;

  const adminHtml = renderStandardEmail({
    title: `New Order #${shortId} Received`,
    badge: { text: `New Order #${shortId} — A$${params.total.toFixed(2)}`, type: "info" },
    bodyHtml: adminBodyHtml,
    cta: {
      text: "View Order in Admin",
      url: `${appUrl}/admin/orders/${encodeURIComponent(params.orderId)}`,
    },
    isAdmin: true,
  });

  await Promise.all([
    // Customer confirmation
    ...(params.audience !== "admin" ? [sendEmail({
      to: [{ email: params.email, name: params.name }],
      subject: `Order confirmed — #${shortId}`,
      htmlContent: customerHtml,
      ...(params.idempotencyKey ? { headers: { idempotencyKey: params.idempotencyKey } } : {}),
    })] : []),
    // Admin notification
    ...(params.audience !== "customer" ? [sendEmail({
      to: [{ email: ADMIN_EMAIL, name: ADMIN_NAME }],
      subject: `New Order #${shortId} — A$${params.total.toFixed(2)} from ${params.name}`,
      htmlContent: adminHtml,
      ...(params.idempotencyKey ? { headers: { idempotencyKey: params.idempotencyKey } } : {}),
    })] : []),
  ]);
}

export async function sendOrderCancellationEmail(params: {
  email: string;
  name: string;
  orderId: string;
  total: number;
  refundAmount: number;
  autoRefunded: boolean;
  isPartial?: boolean;
  audience?: "customer" | "admin";
  idempotencyKey?: string;
}): Promise<void> {
  const shortId = escapeHtml(params.orderId.slice(-8).toUpperCase());
  const firstName = escapeHtml(params.name.split(" ")[0] || "there");
  const isPartial = params.isPartial ?? false;

  const refundNote = params.autoRefunded
    ? `A full refund of <strong>A$${params.refundAmount.toFixed(2)}</strong> has been automatically issued to your original payment method. Please allow 5–10 business days for it to appear.`
    : isPartial
      ? `A partial refund of <strong>A$${params.refundAmount.toFixed(2)}</strong> has been issued to your original payment method. Please allow 5–10 business days for it to appear.`
      : `A full refund of <strong>A$${params.refundAmount.toFixed(2)}</strong> has been issued to your original payment method. Please allow 5–10 business days for it to appear.`;

  const subject = params.autoRefunded
    ? `Order #${shortId} cancelled & refunded`
    : isPartial
      ? `Partial refund issued for Order #${shortId}`
      : `Order #${shortId} refunded`;

  const customerBodyHtml = `
    <p style="margin:0 0 16px;color:#334155;">
      ${params.autoRefunded ? "Your order has been successfully cancelled." : "We've processed a refund for your order."} ${refundNote}
    </p>

    ${renderCard(`
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e293b;">
        <tr>
          <td style="padding:6px 0;color:#64748b;width:40%;">Order Number:</td>
          <td style="padding:6px 0;font-weight:700;">#${shortId}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Original Total:</td>
          <td style="padding:6px 0;">A$${params.total.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Refund Amount:</td>
          <td style="padding:6px 0;font-weight:800;color:#dc2626;">A$${params.refundAmount.toFixed(2)}</td>
        </tr>
      </table>
    `, { title: "Refund Summary", bg: "#fef2f2", border: "#fecaca" })}

    <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
      If you have questions about your refund or need help with a replacement item, simply reply to this email or reach out to our support team.
    </p>
  `;

  const customerHtml = renderStandardEmail({
    title: subject,
    badge: {
      text: params.autoRefunded ? `Order #${shortId} Cancelled & Refunded` : `Order #${shortId} Refunded`,
      type: "danger",
    },
    greeting: `Hi ${firstName},`,
    bodyHtml: customerBodyHtml,
  });

  if (params.audience !== "admin") await sendEmail({
    ...(params.idempotencyKey ? { headers: { idempotencyKey: params.idempotencyKey } } : {}),
    to: [{ email: params.email, name: params.name }],
    subject,
    htmlContent: customerHtml,
  });

  // Also notify admin
  if (params.audience !== "customer") await sendEmail({
    ...(params.idempotencyKey ? { headers: { idempotencyKey: params.idempotencyKey } } : {}),
    to: [{ email: ADMIN_EMAIL, name: ADMIN_NAME }],
    subject: `[Admin] ${params.autoRefunded ? "Auto-refund" : "Refund issued"} for Order #${shortId}`,
    htmlContent: renderStandardEmail({
      title: `[Admin] Refund for Order #${shortId}`,
      badge: { text: `${params.autoRefunded ? "Auto-refund" : "Refund"} Issued — Order #${shortId}`, type: "neutral" },
      bodyHtml: `
        ${renderCard(`
          <p><strong>Order:</strong> #${shortId}</p>
          <p><strong>Amount:</strong> A$${params.refundAmount.toFixed(2)}</p>
          <p><strong>Customer:</strong> ${escapeHtml(params.name)} (${escapeHtml(params.email)})</p>
        `, { title: "Refund Details" })}
      `,
      isAdmin: true,
    }),
  });
}

export async function sendRefundRequestEmail(params: {
  email: string;
  name: string;
  orderId: string;
  total: number;
  reason: string;
  audience?: "customer" | "admin";
  idempotencyKey?: string;
}): Promise<void> {
  const shortId = escapeHtml(params.orderId.slice(-8).toUpperCase());
  const firstName = escapeHtml(params.name.split(" ")[0] || "there");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://completehomesollution.com.au").replace(/\/$/, "");

  // Customer: acknowledge receipt of request
  const customerBodyHtml = `
    <p style="margin:0 0 16px;color:#334155;">
      We've received your refund request for Order <strong>#${shortId}</strong>. Our customer care team will review your request and get back to you within 1–2 business days.
    </p>

    ${renderCard(`
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.5;">${escapeHtml(params.reason)}</p>
    `, { title: "Submitted Reason", bg: "#f8fafc" })}

    <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
      If you have additional details or photos to provide, you can simply reply directly to this email.
    </p>
  `;

  const customerHtml = renderStandardEmail({
    title: `Refund request received — Order #${shortId}`,
    badge: { text: "Refund Request Received", subtitle: `Order #${shortId}`, type: "neutral" },
    greeting: `Hi ${firstName},`,
    bodyHtml: customerBodyHtml,
  });

  if (params.audience !== "admin") await sendEmail({
    ...(params.idempotencyKey ? { headers: { idempotencyKey: params.idempotencyKey } } : {}),
    to: [{ email: params.email, name: params.name }],
    subject: `Refund request received — Order #${shortId}`,
    htmlContent: customerHtml,
  });

  // Admin: alert with link to order
  const adminBodyHtml = `
    ${renderCard(`
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e293b;">
        <tr>
          <td style="padding:6px 0;color:#64748b;width:30%;">Order:</td>
          <td style="padding:6px 0;font-weight:700;">#${shortId}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Customer:</td>
          <td style="padding:6px 0;">${escapeHtml(params.name)} (${escapeHtml(params.email)})</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Order Total:</td>
          <td style="padding:6px 0;font-weight:700;">A$${params.total.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;vertical-align:top;">Reason:</td>
          <td style="padding:6px 0;line-height:1.5;">${escapeHtml(params.reason)}</td>
        </tr>
      </table>
    `, { title: "Refund Request Summary" })}
  `;

  if (params.audience !== "customer") await sendEmail({
    ...(params.idempotencyKey ? { headers: { idempotencyKey: params.idempotencyKey } } : {}),
    to: [{ email: ADMIN_EMAIL, name: ADMIN_NAME }],
    subject: `[Action Required] Refund request for Order #${shortId} — A$${params.total.toFixed(2)}`,
    htmlContent: renderStandardEmail({
      title: `[Action Required] Refund Request #${shortId}`,
      badge: { text: `Refund Requested — Order #${shortId}`, type: "warning" },
      bodyHtml: adminBodyHtml,
      cta: {
        text: "Review Order in Admin",
        url: `${appUrl}/admin/orders/${encodeURIComponent(params.orderId)}`,
      },
      isAdmin: true,
    }),
  });
}

export async function sendShippingUpdateEmail(params: {
  email: string;
  name: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  idempotencyKey?: string;
}): Promise<void> {
  const shortId = escapeHtml(params.orderId.slice(-8).toUpperCase());
  const firstName = escapeHtml(params.name?.split(" ")[0] || "there");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://completehomesollution.com.au").replace(/\/$/, "");
  const orderUrl = `${appUrl}/order-confirmation/${encodeURIComponent(params.orderId)}?token=${createGuestOrderToken(params.orderId, params.email)}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;">
      Great news! Your order <strong>#${shortId}</strong> has been carefully packed and dispatched. You can track your shipment as it travels to your delivery address.
    </p>

    ${renderCard(`
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e293b;">
        <tr>
          <td style="padding:6px 0;color:#64748b;width:40%;">Order Number:</td>
          <td style="padding:6px 0;font-weight:700;">#${shortId}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Carrier:</td>
          <td style="padding:6px 0;font-weight:700;">${escapeHtml(params.carrier)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Tracking Number:</td>
          <td style="padding:6px 0;font-weight:700;color:#1a2e5a;">${escapeHtml(params.trackingNumber)}</td>
        </tr>
      </table>
    `, { title: "Dispatch & Tracking Details", bg: "#f8fafc" })}

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
      Tracking events typically take a few hours to sync with carrier scans after parcel collection.
    </p>
  `;

  const htmlContent = renderStandardEmail({
    title: `Your order #${shortId} has shipped!`,
    badge: { text: "Order Dispatched & On Its Way", type: "success" },
    greeting: `Hi ${firstName},`,
    bodyHtml,
    cta: { text: "View Order & Tracking", url: orderUrl },
  });

  await sendEmail({
    ...(params.idempotencyKey ? { headers: { idempotencyKey: params.idempotencyKey } } : {}),
    to: [{ email: params.email, name: params.name }],
    subject: `Your Complete Home Sollution order #${shortId} has shipped!`,
    htmlContent,
  });
}
