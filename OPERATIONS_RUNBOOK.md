# Payment and notification operations

Owner: the store operations administrator with access to the payment provider, Brevo, Sentry, and the admin orders page. Assign a named person and backup in the deployment record.

## Monitors

- Poll `GET /api/health` from the deployed host. Any 503 means the app cannot read its database.
- Poll `GET /api/health/operations` with `Authorization: Bearer <CRON_SECRET>` from a trusted monitor. A 503 or nonzero `refundActions`, `overdueEmailJobs`, `failedStockAlerts`, `paymentReviews`, or `fulfillmentReviews` needs investigation. Do not expose the secret in a public monitor URL.
- Configure Sentry alert rules for server errors and the cron routes. Set a notification destination and verify a test alert arrives before launch.
- The scheduled `check-operations` route queues one staff email per stuck payment or unfulfilled order. `send-email-jobs` sends those alerts and paid-order confirmations. `send-stock-alerts` sends restock notices. Review their scheduler execution logs daily.

### Vercel Hobby test schedule

`vercel.json` schedules each of the four workers **once daily** to meet [Vercel Hobby's cron restriction](https://vercel.com/docs/cron-jobs/manage-cron-jobs): payment reconciliation at 00:00 UTC, operations checks at 01:00 UTC, queued emails at 02:00 UTC, and restock notices at 03:00 UTC. On Hobby, each invocation can occur at any time during its scheduled hour. Set the same `CRON_SECRET` (at least 32 characters for this app) in Vercel; Vercel supplies it as a bearer token when it invokes a cron route. Confirm each job returns 200 in the Vercel logs after deployment. Vercel does not automatically retry a failed cron invocation.

This daily cadence is only a deployment/testing fallback. Payment return and provider webhooks can settle an order promptly, but a closed browser plus a missed webhook may wait roughly a day for reconciliation. Queued receipts, staff alerts, and restock notices can also wait roughly a day; each email run processes at most 20 jobs, so a backlog may take longer. Do not promise prompt notifications or payment recovery with this schedule. Before live operation, arrange a permitted host/scheduler with frequent authenticated calls to these existing routes and verify their logs and failure alerts. Vercel also [restricts Hobby to non-commercial personal use](https://vercel.com/docs/plans/hobby), so the store cannot use that plan for live commercial sales.

Pending order items hold available stock. When `paymentReviews` is nonzero, inspect the provider checkout before closing the order: a payment can still complete after the browser leaves. A provider-confirmed rejection or expiry releases the hold when the order becomes `CANCELLED`. Unknown outcomes stay pending and need reconciliation; do not cancel them only to free inventory.

## Refund required after payment

An approved payment with exhausted stock becomes `CANCELLED` with `refundRequested=true`. A durable `REFUND_ACTION` email job points staff to the order. Confirm the provider's captured payment, issue the refund through the admin order refund panel or the provider dashboard, and verify both the provider transaction and local `REFUNDED` state. Record the case privately; do not copy customer details into repository issues. If the provider outcome is unknown, reconcile it before retrying a refund.

## Notification delivery

`EmailJob` records are created in the payment transaction and retried by the cron worker with a claim lease and capped backoff. `StockAlert` records use the same claim and retry pattern after inventory returns. Inspect records with `status=PENDING` and `attempts>=3` or stock alerts with `attempts>=3`; fix Brevo credentials or provider availability, then let the scheduler retry. Brevo's idempotency key limits duplicates for recent retries, but it expires; check provider delivery history when a send succeeded and the database confirmation failed.

## Deployment checks

Run `npm run release:preflight` on staging before serving the release. Migrate before the new cron code starts. Confirm that `CRON_SECRET`, `BREVO_API_KEY`, `SENTRY_DSN`, gateway credentials, and Redis credentials are configured. Confirm each scheduler route receives authorized requests on the actual host. Run payment, refund, email, restore, and rollback acceptance cases from the readiness report before live payments.
