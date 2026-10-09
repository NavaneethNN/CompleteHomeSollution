# OnlinePay membership and refund review — 20 September 2026

## Implemented

- Replaced the standalone PayWay-token membership endpoint with Westpac OnlinePay hosted checkout. A billing form supplies the customer details required for 3DS. Prices and duration come from the server. Account row locking reuses an outstanding membership checkout.
- Fixed the `/account/membership` redirect loop and connected membership Join/Renew buttons to the billing form.
- Stored plan ID, duration, and membership fee on each order. Order settlement, stock changes, membership activation, and its payment record now commit atomically. Failed activation leaves the order pending for reconciliation. Duplicate payment deliveries do not extend membership twice.
- Fixed expiry enforcement racing with a renewal. Admin customer membership changes now use the central grant/revoke helpers.
- Added matched OnlinePay API refunds. Verify the original checkout's reference, AUD amount, currency and transaction success before selecting its transaction ID. Send integer cents and an idempotency UUID derived from the exact order/refund attempt. Validate the refund response before changing local state.
- Pending refund responses are reconciled by reading their refund transaction, including its parent payment, type, currency, amount and final status.
- Retain exact refund amount and stock option during uncertain outcomes. Retrying those same parameters reuses the provider key. Conditional completion prevents duplicate stock restoration. Customer pre-shipment cancellations use OnlinePay; membership fees remain subject to admin review under the existing refund policy.
- Full refunds remove membership time attributable to that order while retaining subsequent paid renewal time and explicit administrator changes. Partial refunds retain membership until the order is fully refunded.
- Block fulfilment updates during refund processing or an outstanding refund request. Include paid-but-unfulfillable cancelled orders in admin refund controls. Use remaining balance for partial-refund UI.
- Prevent legacy Stripe failure notifications from cancelling an OnlinePay or already-settled order.
- Removed a literal webhook secret from `PAYMENT_GATEWAY_FIXES.md`. A scan for configured secret values found no remaining matches in project source/docs (excluding environment files and generated/dependency folders).
- Adjusted customer spending to avoid counting the new membership orders twice and to subtract refunds; membership revenue excludes fully refunded payments.

## Deployment and verification still required

1. Apply the checked-in migrations, including `20260920000100_membership_purchase_snapshot`, before deploying this application code, then generate the Prisma client. No remote database migration was applied in this review. The additive migration snapshots identifiable existing pending add-ons; ambiguous older purchases need reconciliation against provider records.
2. Rotate `ONLINEPAY_WEBHOOK_SECRET` in the application environment and the Westpac notification configuration together. Removing it from a report does not revoke previous copies. Do not paste the new value into documentation.
3. Complete a sandbox card payment for a standalone membership and a cart with membership, verify activation on browser return and webhook/cron delivery, then complete a partial and full refund. The connectivity smoke test creates an unpaid sandbox checkout; it does not demonstrate an actual card charge or refund.
4. Keep the authenticated OnlinePay notification endpoint and reconciliation cron configured. A checkout-creation timeout with no recorded provider ID remains pending for operator reconciliation; no second checkout is issued automatically while its outcome is unknown.
5. On an uncertain refund, retry exactly the original amount and stock option. A different refund is blocked until reconciliation. If the provider continues reporting pending or the original checkout/transaction is unavailable, inspect the OnlinePay dashboard before changing local records. Legacy locks created before refund-attempt fields existed require operator reconciliation.

## Official API references

- [Westpac hosted checkout integration and 3DS billing requirements](https://merchants.westpac.com.au/onlinepay/docs/integrate-checkout)
- [Westpac matched refund API and idempotency header](https://merchants.westpac.com.au/onlinepay/reference/refundpayment)
- [Westpac transaction lookup](https://merchants.westpac.com.au/onlinepay/reference/readtransaction)

Automated checks exercise application logic with isolated authentication/database/provider adapters. They do not prove production database concurrency, merchant refund permissions, card settlement, or the absence of all security vulnerabilities.
