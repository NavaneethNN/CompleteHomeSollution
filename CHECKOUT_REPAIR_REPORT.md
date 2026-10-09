# Checkout repair report — 18 September 2026

## Current status (verified against the sandbox API)

The database error is fixed and the latest OnlinePay test checkout is verified as paid.

1. `ONLINEPAY_RETURN_BASE_URL` and `NEXT_PUBLIC_APP_URL` are configured for local HTTPS: `https://localhost:3000`.
2. `npm run dev:https` starts Next on `https://localhost:3000` using the repo-local `certificates/localhost-key.pem` and `certificates/localhost.pem` files. These files are ignored by Git.
3. OnlinePay sandbox accepted a hosted checkout with the localhost HTTPS return URL. No card was submitted during that script check.
4. Existing checkout `cbc59819-6de2-46d3-a179-03edd7242fa4` was read from OnlinePay as `COMPLETED` with `TRANSACTION_SUCCESS`; order `cmu7594u60001ky3chhasnzlt` was settled locally to `PAID`.
5. The confirmation page for that order returns HTTP 200 and renders `Order Confirmed`.

The provider requires HTTPS for return URLs: [OnlinePay checkout API](https://merchants.stgeorge.com.au/onlinepay/reference/postv2checkout). Localhost works when served as HTTPS for browser returns. Server-to-server webhooks still need a public HTTPS URL because Westpac cannot call a private laptop address.

## Repairs

- Applied additive gateway-field and refund-claim migrations to the configured database. Existing Stripe identifiers remain intact. The missing columns were `paywayTransactionId`, `paywayRefundId`, and `paywaySessionId`; the idempotency migration was already applied.
- Removed the misleading fallback that disabled idempotency on any missing-column error.
- Added required OnlinePay line-item `total_amount`; include shipping, GST and membership in hosted line items.
- Use server-selected gateway settings in the browser. Keep checkout retry keys across ambiguous failures and scope replay to the owner.
- Verify checkout ID, order reference, AUD amount and currency before settlement. Only `TRANSACTION_SUCCESS` is payment evidence; a successful 3DS/token event is not.
- Claim PENDING orders atomically before stock/coupon updates, preventing concurrent callbacks from settling twice. Preserve OnlinePay checkout identifiers for reconciliation and prevent routing them to PayWay refunds.
- Added durable refund claims, approval checks, remaining-refundable-amount checks, and explicit manual-provider refund handling. Ambiguous refund outcomes retain the claim for operator reconciliation rather than automatically retrying.
- Signed guest order links replace email-address access tokens. Guest confirmation emails link to the actual order.
- Pending/cancelled/refunded orders no longer display confirmed success or clear the cart. Paid confirmation removes purchased quantities once per tab session and retains unrelated items. Polling backs off, retries transient failures, and offers a status retry/hosted-payment continuation.
- Snapshot addresses when creating orders; failed validation does not create orphan addresses, and address-book edits cannot rewrite an existing order's destination.
- Fetch prices/weights only for the cart's products, align member free shipping, reject unverifiable shipping prices, cache shipping quotes briefly, bound order-list queries and add order indexes.
- Admin shows pending orders, correct item counts and guest identities; unpaid totals are excluded from revenue. Status transitions cannot fabricate payment/refund success.
- Configure the Neon WebSocket driver on Node 20, reuse the client, bound its connection pool, and allow sufficient connection acquisition time.
- Use Next.js `after` for confirmation notification work instead of untracked promises.
- OnlinePay hosted return URLs now include a scoped, expiring `return_token`. This lets the customer return from the bank to the exact order even when the gateway host differs from the original login-cookie host.
- Order confirmation and pending-payment polling accept the signed return token for that order, without treating the token as payment proof. Payment still comes only from the server-side provider lookup.
- Added a confirmation-page error boundary so transient database/provider failures show a retry message rather than a misleading 404.
- Allowed `/order-confirmation/...` as a safe login callback.
- Added a password-free local HTTPS dev script using repo-local certificate files.

## Validation

- `npm run test:checkout`: 10 regression tests covering payment evidence, provider request errors/required fields, guest access, signed return tokens, and cart quantities/variants.
- `npm run check:checkout`: read-only check with the application's actual Prisma adapter passed; gateway setting presence verified without printing secrets.
- `npm run check:order-transaction`: order creation, duplicate settlement claim, one inventory decrement and duplicate refund claim passed. All test writes rolled back; no customer order/payment was created.
- `npm run check:onlinepay`: sandbox hosted checkout created with the configured return URL; server-side lookup returned matching reference, amount and currency. No card was submitted and no payment was taken.
- `npm run type-check`: passed.
- Local HTTPS checks:
  - `curl -k -I https://localhost:3000/checkout` returned HTTP 200.
  - `curl -k https://localhost:3000/order-confirmation/cmu7594u60001ky3chhasnzlt?...` returned HTTP 200 and rendered `Order Confirmed`.
  - `curl -k https://localhost:3000/api/orders/cmu7594u60001ky3chhasnzlt/poll-payment?...` returned `{"status":"paid","orderId":"cmu7594u60001ky3chhasnzlt"}`.

One non-payment issue remains visible in the local server log: Brevo rejected the confirmation email with `API Key is not enabled`. The notification failure is caught and does not roll back the paid order.

## Remaining validation and capacity work

For local testing, keep the dev server on HTTPS: `npm run dev:https`, then open `https://localhost:3000`. Chrome may warn that the repo-local certificate is self-signed; continue to the site for local development.

For webhook-only completion testing, use a public HTTPS URL or deployment. `https://localhost:3000` is reachable by your browser, but not by Westpac's servers.

This work does not establish support for 100,000 concurrent users. That needs measured load tests, provider quotas, deployment/database sizing, shared request throttling and worker capacity. Further work is also required for durable notification/membership retries, scheduled reconciliation of abandoned/ambiguous payments, pre-payment inventory reservations, and automatic OnlinePay refunds. Inventory is still allocated after payment; if it sells out in the meantime the order is flagged for a refund. Ambiguous PayWay responses without a transaction ID require operator reconciliation. Oversized freight still needs a parcel/freight policy rather than the existing capped parcel estimate.

Do not run `prisma db push` to resolve this incident: additive tracked migrations have already been deployed. No application deployment was performed.
