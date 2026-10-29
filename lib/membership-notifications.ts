import { sendEmail } from "./brevo";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

function siteOrigin(): string {
  const raw = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://completehomesollution.com.au";
  return raw.replace(/\/$/, "");
}

/**
 * Sent when a customer manually cancels their membership.
 * Confirms that autopay has been stopped and benefits have ended immediately.
 */
export async function sendMembershipCancelledEmail(email: string, name: string): Promise<void> {
  const safeName = escapeHtml(name || "Customer");
  const membershipUrl = `${siteOrigin()}/account/membership`;

  await sendEmail({
    to: [{ email, name }],
    subject: "Your CHS Premium Membership has been Cancelled",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px 24px; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0; color: #991b1b; font-size: 14px; }
    .button { display: inline-block; background: #0f172a; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; margin-top: 20px; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Home Solution</h1>
      <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">Membership Update</p>
    </div>
    <div class="content">
      <p style="font-size: 16px; font-weight: 600;">Hi ${safeName},</p>
      <p>As requested, your <strong>CHS Premium Membership</strong> has been cancelled.</p>
      
      <div class="alert-box">
        <strong>Cancellation Summary:</strong><br>
        • Recurring autopay has been stopped immediately.<br>
        • All member benefits (including 5% discount up to $30, member prices, and extended warranty) have ended immediately.<br>
        • No further renewal charges will occur.
      </div>

      <p style="font-size: 14px; color: #475569;">You can re-join the membership program at any time to restore your exclusive discounts and member perks.</p>

      <div style="text-align: center;">
        <a href="${membershipUrl}" class="button">View Membership Details</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Complete Home Solution. All rights reserved.</p>
      <p>18 Edison Drive, Golden Grove SA 5125 · info@completehomesollution.com.au</p>
    </div>
  </div>
</body>
</html>
`,
  });
}

/**
 * Sent when an autopay renewal attempt fails (e.g. insufficient funds, card declined).
 * Alerts customer that retry will happen on a different day.
 */
export async function sendMembershipPaymentRetryEmail(
  email: string,
  name: string,
  retryCount: number,
  nextRetryDate: Date
): Promise<void> {
  const safeName = escapeHtml(name || "Customer");
  const membershipUrl = `${siteOrigin()}/account/membership`;
  const formattedDate = nextRetryDate.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isFinalRetry = retryCount >= 2;
  const subject = isFinalRetry
    ? "Action Required: Final Notice for Membership Renewal Payment"
    : "Payment Issue: CHS Premium Membership Renewal";

  await sendEmail({
    to: [{ email, name }],
    subject,
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px 24px; }
    .warning-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 20px 0; color: #92400e; font-size: 14px; }
    .button { display: inline-block; background: #0f172a; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; margin-top: 20px; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Home Solution</h1>
      <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">Membership Autopay Notice</p>
    </div>
    <div class="content">
      <p style="font-size: 16px; font-weight: 600;">Hi ${safeName},</p>
      <p>We attempted to process your automatic renewal for <strong>CHS Premium Membership</strong>, but the payment could not be completed (e.g. due to insufficient funds or a card processing issue).</p>
      
      <div class="warning-box">
        <strong>Attempt ${retryCount} of 2 Failed:</strong><br>
        • Our system will automatically re-attempt payment on <strong>${formattedDate}</strong> (on a different day).<br>
        • ${isFinalRetry
          ? "This will be the final payment attempt. If it fails, your membership and benefits will be cancelled immediately due to payment method failure."
          : "Please ensure your account has sufficient funds or update your payment details to maintain your benefits without interruption."}
      </div>

      <div style="text-align: center;">
        <a href="${membershipUrl}" class="button">Manage Membership & Payment</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Complete Home Solution. All rights reserved.</p>
      <p>18 Edison Drive, Golden Grove SA 5125 · info@completehomesollution.com.au</p>
    </div>
  </div>
</body>
</html>
`,
  });
}

/**
 * Sent when membership is permanently revoked after 2 failed payment retry attempts on different days.
 */
export async function sendMembershipRevokedFailureEmail(
  email: string,
  name: string,
  reason: string
): Promise<void> {
  const safeName = escapeHtml(name || "Customer");
  const membershipUrl = `${siteOrigin()}/account/membership`;

  await sendEmail({
    to: [{ email, name }],
    subject: "Membership Revoked: Payment Method Failure Issue",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #991b1b; padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px 24px; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0; color: #991b1b; font-size: 14px; }
    .button { display: inline-block; background: #0f172a; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; margin-top: 20px; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Home Solution</h1>
      <p style="margin: 6px 0 0; color: #fecaca; font-size: 13px;">Membership Revocation Notice</p>
    </div>
    <div class="content">
      <p style="font-size: 16px; font-weight: 600;">Hi ${safeName},</p>
      <p>Your <strong>CHS Premium Membership</strong> has been revoked due to a <strong>payment method failure issue</strong>.</p>
      
      <div class="alert-box">
        <strong>Reason for Revocation:</strong><br>
        Automatic renewal payments failed after 2 retry attempts on different days (due to insufficient funds or card decline).<br><br>
        <strong>Status:</strong><br>
        • Autopay recurring billing has been terminated.<br>
        • Member pricing, exclusive discounts, and all membership benefits have ended.
      </div>

      <p style="font-size: 14px; color: #475569;">You can restart your membership anytime with an updated payment method by visiting your membership page.</p>

      <div style="text-align: center;">
        <a href="${membershipUrl}" class="button">Renew Membership</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Complete Home Solution. All rights reserved.</p>
      <p>18 Edison Drive, Golden Grove SA 5125 · info@completehomesollution.com.au</p>
    </div>
  </div>
</body>
</html>
`,
  });
}

