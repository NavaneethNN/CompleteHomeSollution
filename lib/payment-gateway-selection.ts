export type PaymentGateway = "onlinepay" | "payway";

/** A public setting may confirm the server choice, but must never select it. */
export function configuredPaymentGateway(env: Record<string, string | undefined>): PaymentGateway | null {
  const gateway = env.PAYMENT_GATEWAY;
  if (gateway !== "onlinepay" && gateway !== "payway") return null;
  if (env.NEXT_PUBLIC_PAYMENT_GATEWAY && env.NEXT_PUBLIC_PAYMENT_GATEWAY !== gateway) return null;
  return gateway;
}
