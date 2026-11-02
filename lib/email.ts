import { renderStandardEmail, renderCard, escapeHtml } from "@/lib/email-template";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function getBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

async function sendTransactionalEmail(email: string, name: string, subject: string, htmlContent: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set in environment variables.");

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_FROM_NAME ?? "Complete Home Sollution",
        email: process.env.BREVO_FROM_EMAIL ?? "noreply@completehomesollution.com.au",
      },
      to: [{ email, name }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    console.error("[Brevo] Transactional email delivery failed", { status: response.status, message: err?.message, code: err?.code });
    throw new Error(`Brevo API error (HTTP ${response.status})`);
  }
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const firstName = escapeHtml(name?.split(" ")[0] || "there");

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      Thanks for creating an account with Complete Home Sollution! To complete your registration and start browsing exclusive furniture and member pricing, please verify your email address.
    </p>

    ${renderCard(`
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;">Or copy and paste this verification URL into your browser:</p>
      <p style="margin:0;font-size:12px;color:#e03d2a;word-break:break-all;font-weight:500;">${escapeHtml(verifyUrl)}</p>
    `, { title: "Direct Verification Link" })}

    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
      This link will expire in <strong>24 hours</strong>. If you did not create an account, you can safely disregard this message.
    </p>
  `;

  const html = renderStandardEmail({
    title: "Verify your email — Complete Home Sollution",
    badge: { text: "Please Verify Your Email", type: "success" },
    greeting: `Hi ${firstName},`,
    bodyHtml,
    cta: { text: "Verify My Email", url: verifyUrl },
  });

  await sendTransactionalEmail(email, name, "Verify your email — Complete Home Sollution", html);
}

export async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
  const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const firstName = escapeHtml(name?.split(" ")[0] || "there");

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      We received a request to reset your password for your Complete Home Sollution account. Click the button below to choose a new secure password.
    </p>

    ${renderCard(`
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;">Or copy this secure reset link into your browser:</p>
      <p style="margin:0;font-size:12px;color:#e03d2a;word-break:break-all;font-weight:500;">${escapeHtml(resetUrl)}</p>
    `, { title: "Direct Password Reset Link" })}

    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
      This reset link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email—your account remains completely secure.
    </p>
  `;

  const html = renderStandardEmail({
    title: "Reset your password — Complete Home Sollution",
    badge: { text: "Password Reset Request", type: "info" },
    greeting: `Hi ${firstName},`,
    bodyHtml,
    cta: { text: "Reset My Password", url: resetUrl },
  });

  await sendTransactionalEmail(email, name, "Reset your password — Complete Home Sollution", html);
}
