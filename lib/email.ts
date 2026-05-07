const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function getBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  );
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = `${getBaseUrl()}/verify-email?token=${token}`;
  const firstName = name?.split(" ")[0] ?? "there";
  const fromEmail =
    process.env.BREVO_FROM_EMAIL ?? "noreply@completehomesollution.com.au";
  const fromName =
    process.env.BREVO_FROM_NAME ?? "Complete Home Sollution";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f7f3ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ef;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1a2e5a;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
                Complete Home Sollution
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);letter-spacing:0.05em;">
                PREMIUM FURNITURE · AUSTRALIA
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">
                Hi ${firstName}! 👋
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
                Thanks for creating an account with us. To complete your registration
                and start shopping, please verify your email address by clicking the
                button below.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="background:#e03d2a;border-radius:12px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
                      ✓ &nbsp;Verify My Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#888888;line-height:1.6;">
                This link will expire in <strong>24 hours</strong>. If you did not
                create an account, you can safely ignore this email.
              </p>

              <!-- Fallback URL -->
              <div style="background:#f7f3ef;border-radius:10px;padding:14px 16px;margin-top:24px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#888888;text-transform:uppercase;letter-spacing:0.08em;">
                  Or copy this link into your browser
                </p>
                <p style="margin:0;font-size:12px;color:#e03d2a;word-break:break-all;">
                  ${verifyUrl}
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f0ebe5;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#aaaaaa;">
                © ${new Date().getFullYear()} Complete Home Sollution Pty Ltd · Australia
              </p>
              <p style="margin:0;font-size:12px;color:#aaaaaa;">
                You're receiving this because you created an account with
                <a href="mailto:${fromEmail}" style="color:#e03d2a;text-decoration:none;">${fromEmail}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const apiKey = process.env.BREVO_API_KEY;
  console.log("[email] BREVO_API_KEY present:", !!apiKey, "| FROM:", fromEmail, "| TO:", email);
  if (!apiKey) throw new Error("BREVO_API_KEY is not set in environment variables.");

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email, name }],
      subject: "Verify your email — Complete Home Sollution",
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
}
