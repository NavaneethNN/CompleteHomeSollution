import { config } from "dotenv";
config({ quiet: true });
config({ path: ".env.local", override: true, quiet: true });

async function main() {
  if (process.env.ONLINEPAY_MODE !== "test") throw new Error("This smoke test only runs with ONLINEPAY_MODE=test");
  const { createOnlinePayCheckout, getOnlinePayCheckout } = await import("../lib/onlinepay");
  const appUrl = process.env.ONLINEPAY_RETURN_BASE_URL ?? "https://example.com";
  const reference = `integration-check-${Date.now()}`;
  const checkout = await createOnlinePayCheckout({
    amountCents: 100, merchantReference: reference,
    returnUrl: `${appUrl}/checkout`, shopUrl: `${appUrl}/checkout`,
    // Exercise all three address lines; a short fixture missed the provider's
    // 40-character limit and allowed membership checkout to regress.
    customer: { email: "checkout-test@example.com", firstName: "Integration", lastName: "Test", address1: "1 Test Street ".padEnd(120, "A"), city: "Sydney", state: "NSW", postcode: "2000" },
    lineItems: [{ name: "Sandbox integration check", quantity: 1, unitPriceCents: 100 }],
  });
  console.log("PASS: sandbox hosted checkout created (no card submitted or payment taken)");
  const result = await getOnlinePayCheckout(checkout.id);
  if (result.merchant_reference !== reference || result.amount !== 100 || result.currency_code !== "AUD") throw new Error("Sandbox lookup did not return expected verification fields");
  console.log("PASS: server-side lookup returns matching reference, amount and currency");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Sandbox check failed"); if (error instanceof Error && error.cause) console.error(JSON.stringify(error.cause)); process.exitCode = 1; });
