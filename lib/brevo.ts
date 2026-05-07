const BREVO_API_URL = "https://api.brevo.com/v3";

interface SendEmailParams {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: { email: string; name?: string };
}

async function sendEmail(params: SendEmailParams): Promise<void> {
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

export async function sendOrderConfirmationEmail(params: {
  email: string;
  name: string;
  orderId: string;
  total: number;
  items: { name: string; quantity: number; price: number }[];
}): Promise<void> {
  const itemsHtml = params.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td>${i.quantity}</td><td>A$${i.price.toFixed(2)}</td></tr>`
    )
    .join("");

  await sendEmail({
    to: [{ email: params.email, name: params.name }],
    subject: `Order confirmed — #${params.orderId}`,
    htmlContent: `
      <h2>Thanks for your order!</h2>
      <p>Hi ${params.name}, we've received your order and it's being processed.</p>
      <table border="1" cellpadding="8">
        <thead><tr><th>Product</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p><strong>Total: A$${params.total.toFixed(2)}</strong></p>
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
