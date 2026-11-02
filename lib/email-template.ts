/**
 * lib/email-template.ts
 *
 * Centralized, standardized email template generator for Complete Home Sollution.
 * Ensures consistent brand identity, typography, security escaping, and mobile-friendly rendering.
 */

export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char)
  );
}

export interface EmailBadge {
  text: string;
  subtitle?: string;
  type?: "success" | "warning" | "danger" | "info" | "neutral";
  bg?: string;
  color?: string;
  border?: string;
}

export interface EmailCta {
  text: string;
  url: string;
  color?: string;
}

export interface StandardEmailOptions {
  title: string;
  preheader?: string;
  badge?: EmailBadge;
  greeting?: string;
  bodyHtml: string;
  cta?: EmailCta;
  secondaryCta?: EmailCta;
  isAdmin?: boolean;
}

const BADGE_COLORS: Record<
  NonNullable<EmailBadge["type"]>,
  { bg: string; color: string; border: string }
> = {
  success: { bg: "#e8f5e9", color: "#166534", border: "#bbf7d0" },
  warning: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  danger: { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  info: { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  neutral: { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
};

export function renderStandardEmail(options: StandardEmailOptions): string {
  const { title, preheader, badge, greeting, bodyHtml, cta, secondaryCta, isAdmin } = options;

  let badgeHtml = "";
  if (badge) {
    const palette = badge.type ? BADGE_COLORS[badge.type] : {
      bg: badge.bg || "#f8fafc",
      color: badge.color || "#1e293b",
      border: badge.border || "#e2e8f0",
    };

    badgeHtml = `
      <tr>
        <td style="background:${palette.bg};padding:18px 40px;text-align:center;border-bottom:1px solid ${palette.border};">
          <p style="margin:0;font-size:16px;font-weight:800;color:${palette.color};letter-spacing:-0.2px;">
            ${escapeHtml(badge.text)}
          </p>
          ${
            badge.subtitle
              ? `<p style="margin:4px 0 0;font-size:12px;color:${palette.color};opacity:0.9;">${escapeHtml(badge.subtitle)}</p>`
              : ""
          }
        </td>
      </tr>
    `;
  }

  const ctaHtml = cta
    ? `
      <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
        <tr>
          <td style="background:${cta.color || "#e03d2a"};border-radius:12px;text-align:center;">
            <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:14px 34px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
              ${escapeHtml(cta.text)}
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  const secondaryCtaHtml = secondaryCta
    ? `
      <table cellpadding="0" cellspacing="0" style="margin:12px auto 0;">
        <tr>
          <td style="text-align:center;">
            <a href="${escapeHtml(secondaryCta.url)}" style="font-size:13px;font-weight:600;color:#1a2e5a;text-decoration:underline;">
              ${escapeHtml(secondaryCta.text)}
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  const footerHtml = isAdmin
    ? `
      <tr>
        <td style="border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;background:#f8fafc;">
          <p style="margin:0;font-size:12px;color:#64748b;">Complete Home Sollution · Internal Administrative Notification</p>
        </td>
      </tr>
    `
    : `
      <tr>
        <td style="border-top:1px solid #f0ebe5;padding:24px 40px;text-align:center;background:#faf8f5;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#475569;letter-spacing:0.02em;">Complete Home Sollution Pty Ltd · Australian Owned</p>
          <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;">18 Edison Drive, Golden Grove SA 5125 · ABN Registered</p>
          <p style="margin:0;font-size:11px;color:#94a3b8;">
            Need help? Reply directly or email us at
            <a href="mailto:info@completehomesollution.com.au" style="color:#e03d2a;text-decoration:none;font-weight:600;">info@completehomesollution.com.au</a>
          </p>
        </td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  ${preheader ? `<span style="display:none;font-size:0;line-height:0;max-height:0;mso-hide:all;">${escapeHtml(preheader)}</span>` : ""}
</head>
<body style="margin:0;padding:0;background:#f7f3ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ef;padding:36px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,0.06);border:1px solid #ede8e1;">

          <!-- Brand Header -->
          <tr>
            <td style="background:#1a2e5a;padding:30px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Complete Home Sollution</p>
              <p style="margin:6px 0 0;font-size:12px;font-weight:600;color:rgba(255,255,255,0.7);letter-spacing:0.08em;text-transform:uppercase;">PREMIUM FURNITURE · AUSTRALIA</p>
            </td>
          </tr>

          <!-- Optional Status/Announcement Banner -->
          ${badgeHtml}

          <!-- Body Content -->
          <tr>
            <td style="padding:36px 40px;font-size:15px;line-height:1.6;color:#1e293b;">
              ${greeting ? `<p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#0f172a;">${greeting}</p>` : ""}
              ${bodyHtml}
              ${ctaHtml}
              ${secondaryCtaHtml}
            </td>
          </tr>

          <!-- Standard Brand Footer -->
          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Renders a standardized styled card box for order details, tracking, or callouts.
 */
export function renderCard(
  contentHtml: string,
  options?: { title?: string; bg?: string; border?: string; color?: string }
): string {
  const bg = options?.bg || "#f8fafc";
  const border = options?.border || "#e2e8f0";
  const titleColor = options?.color || "#475569";

  return `
    <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:16px 20px;margin:20px 0;">
      ${
        options?.title
          ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;color:${titleColor};text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(
              options.title
            )}</p>`
          : ""
      }
      <div style="font-size:14px;color:#1e293b;line-height:1.6;">
        ${contentHtml}
      </div>
    </div>
  `;
}
