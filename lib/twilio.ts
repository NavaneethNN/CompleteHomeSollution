import twilio from "twilio";

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return _client;
}

export async function sendSms(to: string, body: string): Promise<void> {
  await getClient().messages.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
    body,
  });
}

export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  await sendSms(phone, `Your Complete Home Sollution login code is: ${otp}. Expires in 10 minutes.`);
}

export async function sendOrderConfirmationSms(
  phone: string,
  orderId: string,
  total: number
): Promise<void> {
  await sendSms(
    phone,
    `Complete Home Sollution: Your order #${orderId} is confirmed! Total: A$${total.toFixed(2)}. We'll update you when it ships.`
  );
}

export async function sendShippingUpdateSms(
  phone: string,
  orderId: string,
  trackingNumber: string,
  carrier: string
): Promise<void> {
  await sendSms(
    phone,
    `Complete Home Sollution: Order #${orderId} has shipped via ${carrier}. Tracking: ${trackingNumber}`
  );
}

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  await getClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER!,
    to: `whatsapp:${to}`,
    body,
  });
}

export async function sendOrderWhatsApp(
  phone: string,
  orderId: string,
  total: number
): Promise<void> {
  await sendWhatsApp(
    phone,
    `🛋️ *Complete Home Sollution* — Order Confirmed!\n\nOrder #${orderId}\nTotal: A$${total.toFixed(2)}\n\nThank you for shopping with us! We'll notify you when your order ships.`
  );
}
