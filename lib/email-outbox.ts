import type { Prisma } from "@prisma/client";

export async function queueOrderConfirmation(tx: Prisma.TransactionClient, orderId: string) {
  await tx.emailJob.createMany({
    data: [
      { key: `order:${orderId}:customer`, kind: "ORDER_CUSTOMER", orderId },
      { key: `order:${orderId}:admin`, kind: "ORDER_ADMIN", orderId },
    ],
    skipDuplicates: true,
  });
}

export async function queueRefundAction(tx: Prisma.TransactionClient, orderId: string) {
  await tx.emailJob.createMany({ data: [{ key: `order:${orderId}:refund-action`, kind: "REFUND_ACTION", orderId }], skipDuplicates: true });
}

export async function queueRefundReceipt(tx: Prisma.TransactionClient, orderId: string, cumulativeCents: number, refundAmount: number, autoRefunded: boolean, isPartial: boolean) {
  await tx.emailJob.createMany({
    data: ["customer", "admin"].map(audience => ({
      key: `order:${orderId}:refund:${cumulativeCents}:${audience}`,
      kind: "REFUND_RECEIPT", orderId,
      payload: { refundAmount, autoRefunded, isPartial, audience },
    })),
    skipDuplicates: true,
  });
}

export async function queueShippingEmail(tx: Prisma.TransactionClient, orderId: string) {
  const data = [{ key: `order:${orderId}:shipping`, kind: "SHIPPING", orderId }];
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    data.push({ key: `order:${orderId}:shipping-sms`, kind: "SHIPPING_SMS", orderId });
  }
  await tx.emailJob.createMany({ data, skipDuplicates: true });
}

export async function queueRefundRequest(tx: Prisma.TransactionClient, orderId: string, reason: string) {
  await tx.emailJob.createMany({
    data: ["customer", "admin"].map(audience => ({
      key: `order:${orderId}:refund-request:${audience}`, kind: "REFUND_REQUEST", orderId,
      payload: { reason, audience },
    })), skipDuplicates: true,
  });
}

export function emailRetryMinutes(attempts: number): number {
  return Math.min(60, 2 ** Math.min(Math.max(attempts, 1), 6));
}
