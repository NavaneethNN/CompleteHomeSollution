import { sendEmail } from "./brevo";
import { renderStandardEmail, renderCard, escapeHtml } from "./email-template";

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

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;">
      As requested, your <strong>CHS VIP Membership</strong> has been cancelled.
    </p>

    ${renderCard(`
      <ul style="margin:0;padding-left:18px;color:#991b1b;font-size:14px;line-height:1.6;">
        <li>Recurring autopay has been cancelled immediately.</li>
        <li>All member benefits (5% discount up to $30, member pricing, 3-Year warranty) have ceased.</li>
        <li>No further renewal charges will occur.</li>
      </ul>
    `, { title: "Cancellation Summary", bg: "#fef2f2", border: "#fecaca" })}

    <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
      Ready to return? You can reactivate your membership anytime to restore exclusive discounts and perks.
    </p>
  `;

  const htmlContent = renderStandardEmail({
    title: "Your CHS VIP Membership has been Cancelled",
    badge: { text: "Membership Cancelled", type: "neutral" },
    greeting: `Hi ${safeName},`,
    bodyHtml,
    cta: { text: "View Membership Details", url: membershipUrl },
  });

  await sendEmail({
    to: [{ email, name }],
    subject: "Your CHS Premium Membership has been Cancelled",
    htmlContent,
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

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;">
      We attempted to process your automatic renewal for <strong>CHS VIP Membership</strong>, but the payment could not be completed (e.g. due to insufficient funds or a card processing issue).
    </p>

    ${renderCard(`
      <p style="margin:0 0 8px;font-size:14px;color:#92400e;line-height:1.5;">
        • Our system will automatically re-attempt payment on <strong>${formattedDate}</strong>.
      </p>
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.5;">
        • ${isFinalRetry
          ? "This will be the final payment attempt. If it fails, your membership and benefits will be cancelled immediately due to payment method failure."
          : "Please ensure your account has sufficient funds or update your payment details to maintain your benefits without interruption."}
      </p>
    `, { title: `Attempt ${retryCount} of 2 Failed`, bg: "#fffbeb", border: "#fde68a" })}

    <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
      To keep your 5% discount, member pricing, and warranty benefits active, please review your payment details below.
    </p>
  `;

  const htmlContent = renderStandardEmail({
    title: subject,
    badge: {
      text: isFinalRetry ? "Final Payment Notice" : "Payment Attempt Failed",
      type: "warning",
    },
    greeting: `Hi ${safeName},`,
    bodyHtml,
    cta: { text: "Manage Membership & Payment", url: membershipUrl },
  });

  await sendEmail({
    to: [{ email, name }],
    subject,
    htmlContent,
  });
}

/**
 * Sent when membership is permanently revoked after 2 failed payment retry attempts on different days.
 */
export async function sendMembershipRevokedFailureEmail(
  email: string,
  name: string,
  _reason: string
): Promise<void> {
  const safeName = escapeHtml(name || "Customer");
  const membershipUrl = `${siteOrigin()}/account/membership`;

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;">
      Your <strong>CHS VIP Membership</strong> has been revoked due to a <strong>payment method failure issue</strong>.
    </p>

    ${renderCard(`
      <p style="margin:0 0 8px;font-size:14px;color:#991b1b;line-height:1.5;">
        <strong>Reason for Revocation:</strong><br/>
        Automatic renewal payments failed after 2 retry attempts on different days (due to insufficient funds or card decline).
      </p>
      <ul style="margin:8px 0 0;padding-left:18px;color:#991b1b;font-size:14px;line-height:1.5;">
        <li>Autopay recurring billing has been terminated.</li>
        <li>Member pricing, exclusive discounts, and all membership benefits have ended.</li>
      </ul>
    `, { title: "Revocation Details", bg: "#fef2f2", border: "#fecaca" })}

    <p style="margin:20px 0 0;font-size:14px;color:#475569;">
      You can restart your membership anytime with an updated payment method by visiting your membership page.
    </p>
  `;

  const htmlContent = renderStandardEmail({
    title: "Membership Revoked: Payment Method Failure Issue",
    badge: { text: "Membership Revoked", type: "danger" },
    greeting: `Hi ${safeName},`,
    bodyHtml,
    cta: { text: "Renew Membership", url: membershipUrl },
  });

  await sendEmail({
    to: [{ email, name }],
    subject: "Membership Revoked: Payment Method Failure Issue",
    htmlContent,
  });
}
