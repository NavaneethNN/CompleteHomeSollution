const BREVO_API_URL = "https://api.brevo.com/v3";

interface SendEmailParams {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: { email: string; name?: string };
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: "noreply@completehomesollution.com.au", name: "Complete Home Sollution" },
      ...params,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Brevo email failed: ${JSON.stringify(error)}`);
  }
}

export async function sendOtpEmail(
  email: string,
  name: string,
  otp: string
): Promise<void> {
  await sendEmail({
    to: [{ email, name }],
    subject: "Your Complete Home Sollution login code",
    htmlContent: `
      <h2>Your login code</h2>
      <p>Hi ${name},</p>
      <p>Use the code below to log in to Complete Home Sollution. It expires in 10 minutes.</p>
      <h1 style="letter-spacing:0.3em;font-size:2rem;">${otp}</h1>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

const ADMIN_EMAIL = "info@completehomesollution.com.au";
const ADMIN_NAME  = "Complete Home Sollution";

function buildItemsTable(items: { name: string; quantity: number; price: number }[]): string {
  const rows = items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0ebe5;font-size:14px;color:#1a1a1a;">${i.name}</td>
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
}): Promise<void> {
  const shortId = params.orderId.slice(-8).toUpperCase();
  const firstName = params.name.split(" ")[0] ?? "there";
  const itemsTable = buildItemsTable(params.items);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://completehomesollution.com.au";

  const addrHtml = params.address
    ? `${params.address.line1}${params.address.line2 ? ", " + params.address.line2 : ""}, ${params.address.suburb} ${params.address.state} ${params.address.postcode}, ${params.address.country}`
    : "Not provided";

  // ── Customer email ────────────────────────────────────────────────────────
  const customerHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f7f3ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ef;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1a2e5a;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Complete Home Sollution</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);letter-spacing:0.05em;">PREMIUM FURNITURE · AUSTRALIA</p>
          </td>
        </tr>

        <!-- Success banner -->
        <tr>
          <td style="background:#e8f5e9;padding:20px 40px;text-align:center;border-bottom:1px solid #c8e6c9;">
            <p style="margin:0;font-size:18px;font-weight:800;color:#2e7d32;">✓ &nbsp;Order Confirmed!</p>
            <p style="margin:6px 0 0;font-size:13px;color:#388e3c;">Order #${shortId}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">Hi <strong>${firstName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
              Thank you for your order! We've received your payment and we're getting your items ready.
              You'll receive a shipping notification once your order is on its way.
            </p>

            <!-- Order summary -->
            <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.06em;">Order Summary</p>
            ${itemsTable}

            <!-- Total -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
              <tr>
                <td style="padding:12px 12px;text-align:right;font-size:16px;font-weight:800;color:#1a1a1a;border-top:2px solid #1a2e5a;">
                  Total: A$${params.total.toFixed(2)}
                </td>
              </tr>
            </table>

            <!-- Shipping address -->
            <div style="margin-top:28px;background:#f7f3ef;border-radius:10px;padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Shipping To</p>
              <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.6;">${params.address?.name ?? params.name}<br/>${addrHtml}</p>
            </div>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
              <tr>
                <td style="background:#e03d2a;border-radius:12px;">
                  <a href="${appUrl}/account/orders" style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                    View My Order
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #f0ebe5;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Complete Home Sollution Pty Ltd · Australia</p>
            <p style="margin:0;font-size:12px;color:#aaa;">Questions? Email us at <a href="mailto:${ADMIN_EMAIL}" style="color:#e03d2a;text-decoration:none;">${ADMIN_EMAIL}</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── Admin notification email ───────────────────────────────────────────────
  const adminHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1a2e5a;padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:900;color:#ffffff;">🛒 New Order Received</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Order #${shortId} · A$${params.total.toFixed(2)}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <!-- Customer details -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Customer</p>
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1a1a1a;">${params.name}</p>
              ${params.customerEmail ? `<p style="margin:0 0 4px;font-size:13px;color:#555;">${params.customerEmail}</p>` : ""}
              <p style="margin:8px 0 0;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Ship to</p>
              <p style="margin:4px 0 0;font-size:13px;color:#555;line-height:1.6;">${addrHtml}</p>
            </div>

            <!-- Order items -->
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.06em;">Items Ordered</p>
            ${itemsTable}

            <!-- Total -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
              <tr>
                <td style="padding:12px;text-align:right;font-size:16px;font-weight:800;color:#1a2e5a;border-top:2px solid #1a2e5a;">
                  Total: A$${params.total.toFixed(2)}
                </td>
              </tr>
            </table>

            <!-- Admin link -->
            <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
              <tr>
                <td style="background:#1a2e5a;border-radius:12px;">
                  <a href="${appUrl}/admin/orders/${params.orderId}" style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                    View Order in Admin
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">This is an automated notification from Complete Home Sollution.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await Promise.all([
    // Customer confirmation
    sendEmail({
      to: [{ email: params.email, name: params.name }],
      subject: `Order confirmed — #${shortId}`,
      htmlContent: customerHtml,
    }),
    // Admin notification
    sendEmail({
      to: [{ email: ADMIN_EMAIL, name: ADMIN_NAME }],
      subject: `New Order #${shortId} — A$${params.total.toFixed(2)} from ${params.name}`,
      htmlContent: adminHtml,
    }),
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
}): Promise<void> {
  const shortId = params.orderId.slice(-8).toUpperCase();
  const firstName = params.name.split(" ")[0] ?? "there";
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

  await sendEmail({
    to: [{ email: params.email, name: params.name }],
    subject,
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f7f3ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ef;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a2e5a;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;">Complete Home Sollution</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">PREMIUM FURNITURE · AUSTRALIA</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fef2f2;padding:20px 40px;text-align:center;border-bottom:1px solid #fecaca;">
            <p style="margin:0;font-size:18px;font-weight:800;color:#dc2626;">Order #${shortId} — ${params.autoRefunded ? "Cancelled & Refunded" : "Refunded"}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">Hi <strong>${firstName}</strong>,</p>
            <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
              ${params.autoRefunded ? "Your order has been successfully cancelled." : "We've processed a refund for your order."} ${refundNote}
            </p>
            <div style="background:#f7f3ef;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;">Order</p>
              <p style="margin:0;font-size:14px;color:#1a1a1a;">#${shortId} · Original total: A$${params.total.toFixed(2)}</p>
              <p style="margin:8px 0 0;font-size:14px;color:#1a1a1a;">Refund amount: <strong>A$${params.refundAmount.toFixed(2)}</strong></p>
            </div>
            <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
              Questions? Reply to this email or contact us at <a href="mailto:${ADMIN_EMAIL}" style="color:#e03d2a;">${ADMIN_EMAIL}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #f0ebe5;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Complete Home Sollution Pty Ltd · Australia</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  // Also notify admin
  await sendEmail({
    to: [{ email: ADMIN_EMAIL, name: ADMIN_NAME }],
    subject: `[Admin] ${params.autoRefunded ? "Auto-refund" : "Refund issued"} for Order #${shortId}`,
    htmlContent: `<p>Order <strong>#${shortId}</strong> has been ${params.autoRefunded ? "cancelled and auto-refunded" : "refunded"}.</p><p>Amount: <strong>A$${params.refundAmount.toFixed(2)}</strong></p><p>Customer: ${params.name} (${params.email})</p>`,
  });
}

export async function sendRefundRequestEmail(params: {
  email: string;
  name: string;
  orderId: string;
  total: number;
  reason: string;
}): Promise<void> {
  const shortId = params.orderId.slice(-8).toUpperCase();
  const firstName = params.name.split(" ")[0] ?? "there";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://completehomesollution.com.au";

  // Customer: acknowledge receipt of request
  await sendEmail({
    to: [{ email: params.email, name: params.name }],
    subject: `Refund request received — Order #${shortId}`,
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f3ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ef;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a2e5a;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;">Complete Home Sollution</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">Hi <strong>${firstName}</strong>,</p>
            <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
              We've received your refund request for Order <strong>#${shortId}</strong>. Our team will review it and get back to you within 1–2 business days.
            </p>
            <div style="background:#f7f3ef;border-radius:10px;padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;">Your reason</p>
              <p style="margin:0;font-size:14px;color:#1a1a1a;">${params.reason}</p>
            </div>
            <p style="margin:24px 0 0;font-size:13px;color:#888;">Questions? Contact us at <a href="mailto:${ADMIN_EMAIL}" style="color:#e03d2a;">${ADMIN_EMAIL}</a></p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #f0ebe5;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Complete Home Sollution Pty Ltd</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  // Admin: alert with link to order
  await sendEmail({
    to: [{ email: ADMIN_EMAIL, name: ADMIN_NAME }],
    subject: `[Action Required] Refund request for Order #${shortId} — A$${params.total.toFixed(2)}`,
    htmlContent: `
      <h2>Refund Request Received</h2>
      <p><strong>Order:</strong> #${shortId}</p>
      <p><strong>Customer:</strong> ${params.name} (${params.email})</p>
      <p><strong>Order Total:</strong> A$${params.total.toFixed(2)}</p>
      <p><strong>Reason:</strong> ${params.reason}</p>
      <p><a href="${appUrl}/admin/orders/${params.orderId}" style="background:#1a2e5a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">Review Order in Admin</a></p>
    `,
  });
}

export async function sendShippingUpdateEmail(params: {
  email: string;
  name: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
}): Promise<void> {
  await sendEmail({
    to: [{ email: params.email, name: params.name }],
    subject: `Your Complete Home Sollution order #${params.orderId} has shipped!`,
    htmlContent: `
      <h2>Your order is on its way!</h2>
      <p>Hi ${params.name},</p>
      <p>Carrier: <strong>${params.carrier}</strong></p>
      <p>Tracking number: <strong>${params.trackingNumber}</strong></p>
    `,
  });
}
