const ONLINEPAY_TEST_BASE_URL = "https://cst.test-gsc.vfims.com";
const ONLINEPAY_LIVE_BASE_URL = "https://au.gsc.verifone.cloud";

export type OnlinePayCheckout = { id: string; url: string; details?: Record<string, unknown> };

export type OnlinePayCheckoutStatus = {
  id: string;
  merchant_reference?: string;
  transaction_id?: string;
  status?: string;
  events?: Array<{ type?: string; status?: string; transaction_id?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function onlinePayConfig() {
  if (process.env.ONLINEPAY_MODE && !["test", "live"].includes(process.env.ONLINEPAY_MODE)) throw new Error("Invalid OnlinePay mode");
  const isTest = process.env.ONLINEPAY_MODE !== "live";
  const baseUrl = process.env.ONLINEPAY_BASE_URL ?? (isTest ? ONLINEPAY_TEST_BASE_URL : ONLINEPAY_LIVE_BASE_URL);
  if (!URL.canParse(baseUrl) || new URL(baseUrl).protocol !== "https:") throw new Error("OnlinePay API requires HTTPS");
  const auth = Buffer.from(`${required("ONLINEPAY_USER_UID")}:${required("ONLINEPAY_API_KEY")}`).toString("base64");
  return { baseUrl: baseUrl.replace(/\/$/, ""), auth };
}

export function validateOnlinePayConfiguration() {
  onlinePayConfig();
  for (const key of ["ONLINEPAY_ENTITY_ID", "ONLINEPAY_PPC_ID", "ONLINEPAY_3DS_ID"]) required(key);
}

export class OnlinePayCheckoutError extends Error {
  constructor(message: string, readonly definitelyRejected: boolean, readonly httpStatus?: number, readonly invalidFields: string[] = []) { super(message); }
}

// The Checkout API enforces 40 characters per billing address line.
// Preserve the complete address across its three supported lines.
export function onlinePayBillingAddress(address: string) {
  const value = address.trim();
  if (!value || value.length > 120) {
    throw new OnlinePayCheckoutError("Billing address must contain between 1 and 120 characters.", true, undefined, ["customer_details.billing.address_1"]);
  }
  return {
    address_1: value.slice(0, 40),
    ...(value.length > 40 ? { address_2: value.slice(40, 80) } : {}),
    ...(value.length > 80 ? { address_3: value.slice(80, 120) } : {}),
  };
}

export async function createOnlinePayCheckout(input: {
  amountCents: number;
  merchantReference: string;
  returnUrl: string;
  shopUrl: string;
  customer: { email: string; firstName: string; lastName: string; address1: string; city: string; state: string; postcode: string };
  lineItems: { name: string; quantity: number; unitPriceCents: number }[];
}): Promise<OnlinePayCheckout> {
  validateOnlinePayConfiguration();
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 ||
      input.lineItems.some(item => !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0) ||
      input.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0) !== input.amountCents) {
    throw new OnlinePayCheckoutError("Invalid checkout amount or line items.", true);
  }
  const { baseUrl, auth } = onlinePayConfig();
  const billingAddress = onlinePayBillingAddress(input.customer.address1);

  const response = await fetch(`${baseUrl}/oidc/checkout-service/v2/checkout`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      entity_id: required("ONLINEPAY_ENTITY_ID"),
      currency_code: "AUD",
      amount: input.amountCents,
      merchant_reference: input.merchantReference.slice(0, 50),
      interaction_type: "HPP",
      return_url: input.returnUrl,
      shop_url: input.shopUrl,
      redirect_method: "HEADER_REDIRECT",
      display_line_items: true,
      line_items: input.lineItems.map((item) => ({ name: item.name, quantity: item.quantity, unit_price: item.unitPriceCents, total_amount: item.unitPriceCents * item.quantity })),
      customer_details: {
        entity_id: required("ONLINEPAY_ENTITY_ID"),
        email_address: input.customer.email,
        billing: {
          first_name: input.customer.firstName,
          last_name: input.customer.lastName,
          ...billingAddress,
          city: input.customer.city,
          state: input.customer.state,
          postal_code: input.customer.postcode,
          country_code: "AU",
        },
      },
      configurations: {
        card: {
          shopper_interaction: "ECOMMERCE",
          payment_contract_id: required("ONLINEPAY_PPC_ID"),
          threed_secure: {
            threeds_contract_id: required("ONLINEPAY_3DS_ID"),
            enabled: true,
            transaction_mode: "S",
          },
        },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.url || !payload.id) {
    const message = typeof payload?.message === "string" ? payload.message : "OnlinePay could not create a checkout.";
    const invalidFields = payload?.details && typeof payload.details === "object"
      ? Object.keys(payload.details).filter(key => /^[a-zA-Z0-9_.[\]-]{1,150}$/.test(key)) : [];
    throw new OnlinePayCheckoutError(message, [400, 401, 403, 404, 422].includes(response.status), response.status, invalidFields);
  }
  if (typeof payload.url !== "string" || !URL.canParse(payload.url) || new URL(payload.url).protocol !== "https:") throw new OnlinePayCheckoutError("Invalid hosted checkout URL", false);
  return payload as OnlinePayCheckout;
}

/** Read the checkout on the server. Never trust a browser redirect or webhook
 * body as evidence that a payment succeeded. */
export async function getOnlinePayCheckout(checkoutId: string): Promise<OnlinePayCheckoutStatus> {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(checkoutId)) throw new Error("Invalid OnlinePay checkout ID");
  const { baseUrl, auth } = onlinePayConfig();
  const response = await fetch(`${baseUrl}/oidc/checkout-service/v2/checkout/${encodeURIComponent(checkoutId)}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) throw new Error("OnlinePay could not verify the checkout.");
  return payload as OnlinePayCheckoutStatus;
}

/** Only a transaction event proves payment. 3DS and token events do not. */
export function onlinePayPaymentSucceeded(checkout: OnlinePayCheckoutStatus): boolean {
  return (checkout.events ?? []).some((event) => event.type === "TRANSACTION_SUCCESS");
}

export function onlinePayPaymentFailed(checkout: OnlinePayCheckoutStatus): boolean {
  // A failed attempt can be retried on the hosted page. Only a closed checkout
  // is terminal; otherwise retain PENDING so a later successful attempt settles.
  return !onlinePayPaymentSucceeded(checkout) &&
    ["CANCELLED", "CANCELED", "EXPIRED"].includes(checkout.status?.toUpperCase() ?? "");
}

export class OnlinePayRefundError extends Error {
  constructor(message: string, readonly safeToRetry: boolean) { super(message); }
}

/** Matched refunds use the transaction ID, never the hosted checkout ID. */
export async function refundOnlinePayOrder(input: {
  checkoutId: string; orderId: string; orderTotal: number; amount: number; refundedBefore: number;
}) {
  const amountCents = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || Math.abs(input.amount * 100 - amountCents) > 1e-7) {
    throw new OnlinePayRefundError("Refund amount must be a positive number of cents.", true);
  }
  const checkout = await getOnlinePayCheckout(input.checkoutId);
  if (checkout.id !== input.checkoutId || checkout.merchant_reference !== input.orderId ||
      checkout.amount !== Math.round(input.orderTotal * 100) || checkout.currency_code !== "AUD" || !onlinePayPaymentSucceeded(checkout)) {
    throw new OnlinePayRefundError("Original payment could not be verified.", true);
  }
  const transactionId = checkout.transaction_id ?? checkout.events?.find(event => event.type === "TRANSACTION_SUCCESS" && event.transaction_id)?.transaction_id;
  if (!transactionId || !/^[a-zA-Z0-9-]{8,128}$/.test(transactionId)) {
    throw new OnlinePayRefundError("Original payment transaction ID is unavailable.", true);
  }
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(`onlinepay-refund:${input.orderId}:${transactionId}:${Math.round(input.refundedBefore * 100)}:${amountCents}`).digest("hex");
  const key = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const { baseUrl, auth } = onlinePayConfig();
  const response = await fetch(`${baseUrl}/oidc/api/v2/transactions/${encodeURIComponent(transactionId)}/refund`, {
    method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json", "x-vfi-api-idempotencykey": key },
    body: JSON.stringify({ amount: amountCents, reason: `Refund for order ${input.orderId}` }),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new OnlinePayRefundError("OnlinePay could not confirm the refund. Check the provider before retrying.", [400, 401, 403, 404, 422].includes(response.status));
  }
  if (!result || typeof result.id !== "string" || result.amount !== amountCents ||
      result.payment_provider_contract !== required("ONLINEPAY_PPC_ID")) {
    throw new OnlinePayRefundError("OnlinePay returned an unverified refund. Reconciliation is required.", false);
  }
  let status = result.status === "REFUNDED" ? "approved" : result.status === "DECLINED" || result.status === "FAILED" ? "declined" : "pending";
  if (status === "pending") {
    // Idempotent POST responses can retain their original pending result. Read
    // that refund transaction to reconcile its eventual outcome.
    const lookup = await fetch(`${baseUrl}/oidc/api/v2/transaction/${encodeURIComponent(result.id)}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    const refund = await lookup.json().catch(() => null);
    if (!lookup.ok || refund?.id !== result.id || refund.parent_id !== transactionId || refund.transaction_type !== "REFUND" ||
        refund.currency_code !== "AUD" || typeof refund.amount !== "string" || !/^\d+(\.\d{1,2})?$/.test(refund.amount) || Math.round(Number(refund.amount) * 100) !== amountCents) {
      throw new OnlinePayRefundError("Refund reconciliation could not be verified.", false);
    }
    if (["SETTLED", "COMPLETED"].includes(refund.transaction_status)) status = "approved";
    else if (["DECLINED", "FAILED", "REJECTED", "CANCELLED"].includes(refund.transaction_status)) status = "declined";
  }
  return { transactionId: result.id, status };
}
