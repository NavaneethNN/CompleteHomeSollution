# Independent implementation review — 9 October 2026

**Release verdict: NOT READY.** Reviewed commit `b7b2a58` plus the subsequent uncommitted coupon edits. The other model's completion report mixed verification of earlier work with new changes and incorrectly declared production readiness. Existing tests passed before this review but did not exercise the regressions below.

## Findings corrected

| Finding | Correction and evidence |
|---|---|
| Guest shipping returned 401, blocking ordinary guest purchases that need a shipping quote | Allow both guests and authenticated users; retain shared per-user/IP throttling. Route tests verify a guest receives a signed rate, and a throttled request does not contact the carrier. |
| UI showed tax on merchandise while the server added tax on shipping as well | Both use `checkoutTotals`, with integer-cent rounding. Restore the previous store calculation: merchandise GST plus quoted shipping and the membership fee. Guest checkout test compares the shared display calculation with the stored order and provider line-item cents. Merchant/accounting approval is still required; this review does not certify tax treatment. |
| “ALL” coupon optimization kept old prices/discounts after a membership toggle | Revalidate for price, quantity and membership changes regardless of eligibility label. Key results to the pricing inputs and request sequence; ignore obsolete responses, clear invalid coupons, and block payment during revalidation. Browser component tests exercised membership toggles and delayed responses with mocked services. |
| POST coupon validation rejected `variantId: null` from persisted non-variant carts | Normalize null to absent on the endpoint and omit it from the client request. Test verifies regular and member coupon previews for this cart shape. |
| Malformed shipping/coupon POST JSON returned 500 | Explicit 400 responses, tested for both routes. |
| Coupon utility applied different caps from checkout | Delegate to `calculateCartPricing`; tests cover a fixed coupon with a maximum cap and a percentage exceeding the eligible subtotal. |
| Admin coupon cleanup still contained `any`, sensitive request logging, stale-role authorization and incomplete updates | Remove remaining casts/logging, require a fresh role check, validate merged dates/discounts/restrictions, support explicit null date clearing and replace relations in the same nested Prisma write. Tests cover demotion, invalid updates, restriction replacement and write failure. |
| Checkout address dialog grew above the viewport at 200% CSS zoom | Use a containing-block percentage height constraint and wrap the apartment label. See browser evidence for the scoped result; CSS zoom is supplementary and does not replace human browser/screen-reader acceptance. |

The variant-summary population and POST coupon transport changes were retained. Earlier security fixes, stock/coupon reservations, durable notification jobs, readiness checks and recovery flows remain present. Documentation-only changes to cart stock are not counted as new enforcement; the authoritative server and cart-refresh paths provide that enforcement.

## Verification

- Node 22.23.2; regression suite **99/99 passed** (92 before this review).
- TypeScript passed. Production build passed. Lint passed with 123 warnings; this is not a zero-warning result.
- Production dependency audit: **zero advisories** at review time.
- Real checkout component rendered in Chrome with mocked catalog, coupon and shipping services: coupon repricing, payment blocking and out-of-order response handling passed. No real authentication/payment/provider requests were made by this component test. Evidence: [component results](checkout-component-review-2026-10-09.json).
- Real populated checkout at 390 × 844: zero axe violations before/after address validation, all four sampled invalid controls linked to their errors, and 14 Tab presses stayed within the dialog. At 200% CSS zoom its rectangle is x=32, y=32, width=326, height=780 with no dialog descendant extending past the viewport. The background document still measures wider under this synthetic mobile zoom; this is not a complete page reflow/browser-zoom conformance result. Evidence: [browser results](checkout-browser-review-2026-10-09.json).
- `git diff --check` passed. No existing user changes were reverted or committed.
- The configured database was checked read-only. It fails readiness: `EmailJob` is missing, and order/stock-alert scalar reads fail on missing columns. No migration was applied.
- Local release configuration fails on missing `CRON_SECRET`, invalid `SENTRY_DSN`, and a localhost origin. Secret values are omitted.

## Pending release work

These are not silently accepted or marked complete:

1. Choose staging/hosting and the named merchant/operations approvers, as the user deferred.
2. Deploy every reviewed migration, including the notification payload migration; verify all runtime schema reads and Redis readiness before serving checkout or cron routes.
3. Supply valid deployed origins and service configuration; prove external webhooks, scheduler execution, real notification delivery, alerts, backup restoration and rollback.
4. Execute the production-readiness acceptance matrix: authenticated member/admin journeys, gateway success/failure/3DS and unknown outcomes, actual refund reconciliation, concurrent last-unit/coupon scenarios, and merchant approval of prices, tax, shipping, membership, receipts and policies.
5. Complete human keyboard, actual browser zoom and screen-reader acceptance. The development-only dependency triage and lint warning backlog remain recorded maintenance work.

The earlier `.agents/tasks/AUDIT_COMPLETION_SUMMARY.md` and review files should not be used as launch approval. A successful build and mocked tests cannot establish a bug-free site or close the above environmental and operational requirements.
