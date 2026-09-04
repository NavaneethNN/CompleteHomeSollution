/**
 * lib/payway.ts
 * PayWay REST API client — replaces lib/stripe.ts
 * Docs: https://payway.stgeorge.com.au/docs/rest.html
 */

import { randomUUID } from "crypto";

const PAYWAY_BASE_URL = "https://api.payway.com.au/rest/v1";

/** Build Basic Auth header — secret key as username, password blank (per PayWay spec) */
function secretAuthHeader(): string {
  const encoded = Buffer.from(`${process.env.PAYWAY_SECRET_KEY!}:`).toString("base64");
  return `Basic ${encoded}`;
}

/** Encode an object as application/x-www-form-urlencoded */
function encodeForm(data: Record<string, string | number | undefined>): string {
  return Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export interface PayWayTransaction {
  transactionId: number;
  receiptNumber: string;
  status: "approved" | "approved*" | "pending" | "declined" | "voided" | "suspended";
  responseCode: string;
  responseText: string;
  transactionType: string;
  customerNumber: string;
  orderNumber: string;
  currency: string;
  principalAmount: number;
  surchargeAmount: number;
  paymentAmount: number;
  paymentMethod: string;
  isVoidable: boolean;
  isRefundable: boolean;
}

export interface PayWayFieldError {
  fieldName: string;
  message: string;
  fieldValue: string;
}

export class PayWayApiError extends Error {
  httpStatus: number;
  errors: PayWayFieldError[];

  constructor(message: string, httpStatus: number, errors: PayWayFieldError[] = []) {
    super(message);
    this.name = "PayWayApiError";
    this.httpStatus = httpStatus;
    this.errors = errors;
  }
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH",
  path: string,
  body?: Record<string, string | number | undefined>,
  idempotencyKey?: string
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: secretAuthHeader(),
    Accept: "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let requestBody: string | undefined;
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    requestBody = encodeForm(body);
  }

  const res = await fetch(`${PAYWAY_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    cache: "no-store",
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* ignore */ }

  if (!res.ok) {
    const errors: PayWayFieldError[] = (json?.data as PayWayFieldError[]) ?? [];
    const firstMsg = errors[0]?.message ?? `PayWay API error ${res.status}`;
    throw new PayWayApiError(firstMsg, res.status, errors);
  }

  return json as T;
}

/**
 * Charge a single-use token obtained from the PayWay Trusted Frame.
 * orderNumber is trimmed to 20 chars as required by PayWay.
 */
export async function chargeToken(params: {
  singleUseTokenId: string;
  orderNumber: string;
  principalAmount: number;
  customerIpAddress?: string;
  merchantId?: string;
}): Promise<PayWayTransaction> {
  const idempotencyKey = randomUUID();
  const orderNumber = params.orderNumber.slice(-20);
  const merchantId = params.merchantId ?? process.env.PAYWAY_MERCHANT_ID ?? "TEST";

  return request<PayWayTransaction>(
    "POST",
    "/transactions",
    {
      singleUseTokenId: params.singleUseTokenId,
      customerNumber: orderNumber,
      transactionType: "payment",
      principalAmount: params.principalAmount,
      currency: "aud",
      orderNumber,
      merchantId,
      ...(params.customerIpAddress ? { customerIpAddress: params.customerIpAddress } : {}),
    },
    idempotencyKey
  );
}

/**
 * Refund a previously approved transaction.
 */
export async function refundTransaction(params: {
  parentTransactionId: number | string;
  principalAmount: number;
  orderNumber: string;
}): Promise<PayWayTransaction> {
  const idempotencyKey = randomUUID();
  const orderNumber = params.orderNumber.slice(-20);

  return request<PayWayTransaction>(
    "POST",
    "/transactions",
    {
      transactionType: "refund",
      parentTransactionId: String(params.parentTransactionId),
      principalAmount: params.principalAmount,
      orderNumber,
    },
    idempotencyKey
  );
}

/**
 * Get details of a specific transaction.
 */
export async function getTransaction(
  transactionId: number | string
): Promise<PayWayTransaction> {
  return request<PayWayTransaction>("GET", `/transactions/${transactionId}`);
}

/**
 * Verify API key connectivity — returns true if secret key is valid.
 */
export async function verifyApiKey(): Promise<boolean> {
  try {
    await request<unknown>("GET", "/");
    return true;
  } catch {
    return false;
  }
}
