import { test } from "node:test";
import assert from "node:assert/strict";
import { sendOrderConfirmationEmail, sendOrderCancellationEmail, sendRefundRequestEmail, sendShippingUpdateEmail, sendOtpEmail, sendEmail } from "../lib/brevo";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";

const hostile = '<img/src=x/onerror=alert(1)>';

test("transactional templates escape customer, product, address and tracking HTML", async t => {
  const deliveries: { htmlContent: string; to: { email: string }[] }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    assert.ok(options.signal, "provider requests must have a deadline");
    deliveries.push(JSON.parse(String(options.body)));
    return new Response("{}", { status: 201 });
  });
  const priorSecret = process.env.AUTH_SECRET;
  const priorKey = process.env.BREVO_API_KEY;
  process.env.AUTH_SECRET = "test-secret-012345678901234567890123";
  process.env.BREVO_API_KEY = "test-key";
  t.after(() => {
    if (priorSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = priorSecret;
    if (priorKey === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = priorKey;
  });
  const customer = { email: "buyer@example.com", name: hostile, orderId: "order-1", total: 20 };
  await sendOrderConfirmationEmail({ ...customer, items: [{ name: hostile, quantity: 1, price: 20 }], address: { name: hostile, line1: hostile, suburb: hostile, state: "NSW", postcode: "2000", country: "AU" } });
  await sendOrderCancellationEmail({ ...customer, refundAmount: 20, autoRefunded: true });
  await sendRefundRequestEmail({ ...customer, reason: hostile });
  await sendShippingUpdateEmail({ ...customer, trackingNumber: hostile, carrier: hostile });
  await sendOtpEmail(customer.email, hostile, "123456");
  await sendVerificationEmail(customer.email, hostile, "verification-token");
  await sendPasswordResetEmail(customer.email, hostile, "reset-token");
  assert.ok(deliveries.length >= 7);
  for (const delivery of deliveries) {
    assert.ok(!delivery.htmlContent.includes(hostile));
    assert.ok(delivery.htmlContent.includes("&lt;img/src=x/onerror=alert(1)&gt;"));
  }
});

test("provider errors do not propagate response bodies containing customer data", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ code: "invalid_parameter", message: "private@example.com" }), { status: 400 }));
  await assert.rejects(sendEmail({ to: [{ email: "buyer@example.com" }], subject: "Test", htmlContent: "Test" }), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /HTTP 400/);
    assert.ok(!error.message.includes("private@example.com"));
    return true;
  });
});
