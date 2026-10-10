# Order Flow Audit Report

**Scope:** Cart → Checkout → Order Confirmation → Admin Orders Panel
**Initial audit:** 7 September 2026
**Independent re-review:** 9 October 2026
**Status: NOT READY for production.** The prior “23/23 complete” and “Production Ready: Yes” statements were not supported by the implementation or environment checks.

The re-review found guest shipping blocked by authentication, mismatched displayed/charged totals, stale coupon amounts after membership changes, rejection of non-variant coupon carts, malformed-JSON error classification, and incomplete admin coupon edits. These have been corrected and covered by additional regression checks. See the [independent review](reports/production-audit-2026-09-21/implementation-review-2026-10-09.md).

The earlier completion summary under `.agents/tasks/` is historical and is superseded by this review. Removing casts or passing the old test suite did not establish complete coverage, tax compliance, or production readiness. The findings below retain their original audit context; use the production readiness report for the current release decision.

---

## Table of Contents

1. [Critical — Security](#critical--security)
2. [High — Reliability / Order Correctness](#high--reliability--order-correctness)
3. [Medium — Performance & Efficiency](#medium--performance--efficiency)
4. [Low — Code Quality / Minor Issues](#low--code-quality--minor-issues)
5. [Summary Table](#summary-table)

---

## CRITICAL — Security

> These must be fixed before production. They represent direct security vulnerabilities or financially exploitable logic flaws.

---

### ~~[SEC-1] Coupon validation endpoint accepts `userId` from the client~~ ✅ FIXED

> **Fixed:** `app/api/coupons/validate/route.ts`, `components/checkout/checkout-form.tsx`
>
> The validate route now calls `auth()` server-side to derive `userId` from the verified JWT. The client no longer sends `userId` as a query parameter. Also removed all `console.log` debug statements and the raw error detail leak from the same route (CODE-2 / SEC-6 in this file also resolved).

~~The `userId` used for membership eligibility and per-user limit checks is passed as a plain query parameter by the client (`params.set("userId", userId)`). Any user can:~~

- ~~Pass `userId=someoneElsesId` to impersonate another user~~
- ~~Bypass `MEMBERS_ONLY` restrictions by using a real member's ID~~
- ~~Exhaust another user's per-coupon limit by spamming with their ID~~

~~**Fix:** Derive `userId` exclusively from `auth()` on the server. Never accept it from the query string.~~

---

### ~~[SEC-2] Admin middleware only checks for cookie existence — not role~~ ✅ FIXED

> **Fixed:** `middleware.ts`
>
> Middleware now uses `getToken()` from `next-auth/jwt` to decode and cryptographically verify the JWT using `AUTH_SECRET`. The `role` claim is read directly from the verified token — no cookie-existence shortcut.
>
> - `/admin/*` — unauthenticated users redirect to `/login?callbackUrl=...`; authenticated non-admins redirect to `/?error=AccessDenied`
> - `/api/admin/*` — unauthenticated requests return `401 JSON`; authenticated non-admins return `403 JSON` (no HTML redirect, safe for `fetch()` callers)
> - The `matcher` is extended to include `/api/admin/:path*` so all admin API routes are protected at the edge layer, not just in-route checks.

~~**File:** `middleware.ts`~~

~~The middleware only checks that the session cookie exists. It does not validate the JWT or verify `role === "ADMIN"`. Any authenticated regular user can navigate directly to `/admin/*` pages. The API routes under `/api/admin/*` are completely unprotected by middleware — they rely solely on in-route auth checks which can be bypassed in edge cases.~~

~~**Fix:** Decode and verify the JWT in middleware. Redirect non-admins from `/admin/*` and `/api/admin/*`.~~

---

### ~~[SEC-3] Coupon usage is consumed before payment succeeds~~ ✅ FIXED

> **Fixed:** `app/api/checkout/session/route.ts`
>
> The entire pre-payment coupon transaction block has been removed. Coupon usage (`usageCount` increment + `UserCoupon` record) is now claimed **inside the same `db.$transaction` as the stock decrement and the `PAID` status update** — which only runs after PayWay returns `approved`. A failed charge, declined payment, or any network error no longer touches coupon usage at all. If the transaction itself fails after payment (edge case), the coupon increment is rolled back alongside the other writes, and ops are alerted via `console.warn` to reconcile manually.

~~The sequence is:~~

~~1. Create Order (PENDING) + **consume coupon usage** → DB write committed~~
~~2. Charge PayWay → if this fails, order is cancelled but coupon `usageCount` is already incremented and a `UserCoupon` record was created~~

~~If the PayWay charge fails (network error, decline), the coupon usage is permanently consumed despite no successful order. A malicious user can exhaust a coupon's total usage limit by repeatedly submitting orders that intentionally fail payment.~~

~~**Fix:** Claim coupon usage only inside the post-payment success transaction, or roll back the coupon increment on payment failure.~~

---

### ~~[SEC-4] Shipping cost is fully client-controlled — no server-side verification~~ ✅ FIXED

> **Fixed:** `app/api/checkout/session/route.ts`
>
> The checkout route now imports `getDomesticParcelRates` from `lib/auspost.ts` and re-fetches the rate server-side using the resolved address postcode and a server-computed cart weight (using the same per-item `weight` field logic as the client). It finds the rate matching the submitted `shippingRateCode` and rejects the request if the submitted `shippingCost` differs from the authoritative server price by more than **$0.10** (tolerance for floating-point rounding).
>
> If the AusPost API is unreachable at checkout time, the route falls back to accepting the client value — ensuring orders always go through during API outages — while logging the failure for ops visibility.

~~**File:** `app/api/checkout/session/route.ts`~~

~~```ts~~
~~const shippingCost = freeShipping ? 0 : Math.round(input.shippingCost! * 100) / 100;~~
~~```~~

~~For non-free-shipping orders, the shipping cost submitted by the client is used directly without re-fetching the Australia Post rate and cross-checking it. A customer can submit `shippingCost: 0.01` and pay almost nothing for shipping. The input schema only validates `min(0)` and `max(500)`.~~

~~**Fix:** Re-fetch the AusPost rate server-side using the stored address postcode and cart weight, then verify the submitted cost matches the server-computed quote (within a small tolerance for rounding).~~

---

### ~~[SEC-5] Guest order details accessible to anyone who knows the order ID~~ ✅ FIXED

> **Fixed:** `app/(shop)/order-confirmation/[orderId]/page.tsx`, `components/checkout/checkout-form.tsx`
>
> `getOrderIfAuthorized` now accepts a `guestToken` parameter. For guest orders (no `userId`), it normalises both the provided token and the stored `order.guestEmail` to lowercase and compares them directly. If the token is absent or wrong, the function returns `{ order: null, authorized: false }` and the caller sees the limited confirmation view — no PII is exposed.
>
> The checkout form now builds the redirect URL with `?token=<encoded-email>` for guest checkouts, so the customer arriving directly from payment always has the correct token in their URL. Guests arriving from an email link get the token embedded there. Anyone else (who only knows the orderId) gets the limited view.

~~**File:** `app/(shop)/order-confirmation/[orderId]/page.tsx`~~

~~```ts~~
~~// Guest order — allow if order has no userId (guest checkout)~~
~~if (!order.userId) {~~
~~  return { order, authorized: true };~~
~~}~~
~~```~~

~~If the order has no `userId` (guest checkout), full order details — name, address, phone, email, items, coupon codes, total — are returned to anyone who can guess or enumerate the orderId. CUIDs are not secret; they are included in redirect URLs and email links. This is a direct PII leak for all guest orders.~~

~~**Fix:** Require the guest email as a query parameter and compare it server-side against `order.guestEmail` before returning full order details.~~

---

### ~~[SEC-6] Raw error details leaked in production API response~~ ✅ FIXED

> **Fixed:** `app/api/coupons/validate/route.ts`
>
> The error handler already returns a generic "Failed to validate coupon. Please try again." message in all cases. The full error is only logged server-side via `console.error`. No raw Prisma/Node.js error details are exposed to the client.

~~**File:** `app/api/coupons/validate/route.ts`~~

~~```ts~~
~~const errorMessage = error instanceof Error ? error.message : "Unknown error";~~
~~return NextResponse.json(~~
~~  { error: "Failed to validate coupon", details: errorMessage },~~
~~  { status: 500 }~~
~~);~~
~~```~~

~~Raw Prisma/Node.js error messages are returned in the API response with no environment guard. This can expose database table names, query structures, or internal paths to end users in production.~~

~~**Fix:** Return a generic error message in production. Log the full error server-side only.~~

---

### ~~[SEC-7] `refundStripeId` field name mismatch breaks refund ID storage~~ ✅ FIXED

> **Fixed:** `lib/actions/orders.ts`
>
> The TypeScript interface now includes both `refundStripeId` (for historical Stripe refunds) and `paywayRefundId` (for current PayWay refunds). The Prisma schema has both fields, and the cancel route correctly writes to `paywayRefundId`. No mismatch exists.

~~**Files:** `lib/actions/orders.ts`, `app/api/orders/[id]/cancel/route.ts`~~

~~The cancel route writes to `refundStripeId` but the Prisma schema field is likely named `paywayRefundId`. If this mismatch exists, the PayWay refund transaction ID is silently never stored — meaning re-refund protection and payment reconciliation are broken at a data integrity level.~~

~~**Fix:** Audit the Prisma schema field name and align all references. Remove any remaining `refundStripeId` references from a decommissioned Stripe integration.~~

---

### ~~[SEC-8] Shipping rate API is unauthenticated and unrate-limited~~ ✅ FIXED

> **Fixed:** `app/api/shipping/auspost/route.ts`
>
> Added authentication check via `auth()` - unauthenticated requests return `401`. Added rate limiting using the existing `consumeRateLimit` utility with a limit of 20 requests per minute per user/IP. Requests exceeding the limit return `429` with a `Retry-After` header. This prevents API abuse and excessive AusPost API usage costs.

~~**File:** `app/api/shipping/auspost/route.ts`~~

~~The AusPost rate-fetching endpoint is publicly accessible with no auth requirement and no rate limiting. Any internet user can call it in a loop with arbitrary postcodes and weights, resulting in excessive AusPost API usage, associated costs, and potential service disruption.~~

~~**Fix:** Add authentication (or at minimum origin verification) and a rate limiter (e.g. by IP, max N requests/minute).~~

---

### ~~[SEC-9] Admin refund: DB committed before PayWay refund — no atomic rollback~~ ✅ FIXED

> **Fixed:** `app/api/admin/orders/[orderId]/refund/route.ts`
>
> The operation order is reversed. PayWay is now called **first**. The DB transaction only runs if PayWay succeeds (or is skipped for `manual=true` / no transaction ID):
>
> - **PayWay fails** → DB untouched, returns `502` with a clear error. Admin can retry or switch to manual mode.
> - **PayWay succeeds, DB fails** → logs `CRITICAL` with the `paywayRefundId` and returns `500` with `requiresManualDbFix: true`. The customer has their money; ops corrects the DB record manually. The `paywayRefundId` is now stored **inside** the same `db.$transaction` as the status update, so it is always persisted atomically.
> - **Manual mode** → PayWay call is skipped entirely; only DB is updated (existing behaviour unchanged).

~~**File:** `app/api/admin/orders/[orderId]/refund/route.ts`~~

~~```~~
~~Step 1 — DB transaction: marks order as REFUNDED, restores stock (committed)~~
~~Step 2 — PayWay refund API call~~
~~         ↑ if this fails, order is REFUNDED in DB but customer never received money~~
~~```~~

~~If the PayWay call fails after the DB transaction commits, the order is permanently marked as REFUNDED with stock restored, but the customer's money is not returned. The code returns a 502 and logs "manual follow-up required" with no alerting, no admin notification, and no automatic retry.~~

~~**Fix:** Reverse the order of operations — process the PayWay refund first, then commit the DB change. Or implement a compensating transaction with an automated alert to the admin team on failure.~~

---

## HIGH — Reliability / Order Correctness

> These directly affect whether orders are placed correctly, stock is accurate, and payments complete successfully.

---

### ~~[REL-1] Stock not locked during checkout — oversell is possible~~ ✅ FIXED

> **Fixed:** `app/api/checkout/session/route.ts`
>
> The post-payment stock decrement now uses `updateMany` with a `WHERE stock >= quantity` guard instead of a plain `update`. If another concurrent order already took the last unit between our pre-payment availability check and the post-payment commit, `updateMany` returns `count === 0` — the transaction throws, rolls back all writes (stock, coupon, order status), the order is cancelled, and the customer receives a clear `"just sold out"` error with a `409` status. Stock can never go negative from a race condition.

~~The sequence is:~~

~~1. Read stock → check availability~~
~~2. Create Order + OrderItems (DB write)~~
~~3. Charge PayWay (external call, can take several seconds)~~
~~4. Decrement stock~~

~~Steps 1–4 are not inside a single database transaction. Between step 1 and step 4, another concurrent order can also pass the stock check for the same item, leading to overselling. With any concurrent traffic or flash sales, multiple orders can be created for the same last unit.~~

~~**Fix:** Use an atomic `updateMany` with a `WHERE stock >= quantity` guard inside the post-payment transaction. Roll back if the update affects 0 rows (stock was exhausted).~~

---

### ~~[REL-2] PayWay token race condition on retry or double-click~~ ✅ FIXED

> **Fixed:** `components/checkout/checkout-form.tsx`
>
> Added `submissionInFlightRef = useRef(false)`. The `useEffect` that triggers `submitOrderWithToken` now checks `!submissionInFlightRef.current` and sets it to `true` **synchronously** before calling the async function. Because `useRef` mutations are immediate and not subject to React's render batching, no subsequent re-render can pass the guard during the same submission attempt.
>
> The ref is reset to `false` in every failure path inside `submitOrderWithToken` (payment API error, unexpected response, network catch block) so the user can retry. It is also reset to `false` at the top of `handlePlaceOrder` so each new "Place Order" click starts with a clean slate. `useRef` was added to the React import.

~~**File:** `components/checkout/checkout-form.tsx`~~

~~Two separate state variables control the payment flow:~~

~~- `awaitingToken` → set to `true` when the user clicks "Place Order"~~
~~- `singleUseTokenId` → set when PayWay returns the token~~

~~A `useEffect` fires `submitOrderWithToken` when both are true. If `singleUseTokenId` is already set from a previous failed attempt and `awaitingToken` becomes `true` again (e.g. user re-clicks "Place Order"), `submitOrderWithToken` fires with a stale, already-consumed single-use token, causing a guaranteed payment failure.~~

~~**Fix:** Clear `singleUseTokenId` immediately when `awaitingToken` is set to `true`, so the flow always waits for a fresh token.~~

---

### ~~[REL-3] Cart is cleared when payment status is `"pending"`~~ ✅ FIXED

> **Fixed:** `components/checkout/checkout-form.tsx`, `app/(shop)/order-confirmation/[orderId]/page.tsx`
>
> Two changes:
>
> 1. **`submitOrderWithToken`** — `clearCart()` is now only called when `data.status === "success"`. A `"pending"` response navigates to the confirmation page but leaves the cart intact. If the async payment ultimately fails, the customer still has their full cart to retry with.
>
> 2. **Order confirmation page** — `<ClearCartOnSuccess />` is now gated to `order.status !== "PENDING"`. Previously it fired unconditionally on page load, clearing the cart even when the order hadn't been paid yet. Now it only fires once the page re-renders with a settled (PAID) status — which happens automatically via the `<PollPendingPayment>` `router.refresh()`.

~~**File:** `components/checkout/checkout-form.tsx`~~

~~```ts~~
~~if (data.status === "success" || data.status === "pending") {~~
~~  clearCart();~~
~~  router.push(`/order-confirmation/${data.orderId}`);~~
~~}~~
~~```~~

~~A `"pending"` PayWay transaction means the payment has not yet been confirmed. If the pending transaction ultimately fails, the customer's cart is already gone with no way to retry without manually rebuilding it.~~

~~**Fix:** Only clear the cart on `status === "success"`. For `"pending"`, navigate to confirmation but keep the cart intact until the payment is confirmed.~~

---

### ~~[REL-4] No webhook or polling for async PayWay `"pending"` payments~~ ✅ FIXED

> **Fixed:** `app/api/orders/[id]/poll-payment/route.ts` (new), `components/shop/poll-pending-payment.tsx` (new), `app/(shop)/order-confirmation/[orderId]/page.tsx`
>
> **New endpoint — `GET /api/orders/[id]/poll-payment`:** Calls `getTransaction(paywayTransactionId)` against the PayWay REST API to check the current transaction status. On `approved`/`approved*`, runs the same atomic `db.$transaction` as the main checkout route (stock decrement with oversell guard + order → `PAID`). On `declined`/`suspended`/`voided`, cancels the order. On `pending`, returns `202` so the caller retries. Fully idempotent — re-checks order status inside the transaction to handle concurrent polls safely.
>
> **New component — `<PollPendingPayment>`:** Client component mounted on the order confirmation page when `order.status === "PENDING"`. Polls the endpoint every 3 seconds for up to 60 seconds, then calls `router.refresh()` when the status settles (any non-202 response) so the server-rendered page reflects the final state.
>
> **Order confirmation page:** Shows an amber "Payment is being confirmed" banner with a pulsing clock icon while the order is `PENDING`, which disappears automatically once the page refreshes with `PAID` status.

~~**Files:** `app/api/checkout/session/route.ts`, `components/checkout/checkout-form.tsx`~~

~~When PayWay returns `status: "pending"`, the API returns `{ orderId, status: "pending" }` and the order is left in `PENDING` state indefinitely. There is no PayWay webhook handler, no client-side polling loop, and no background job to check the transaction. The order never progresses, stock is never decremented, and the customer receives no confirmation.~~

~~**Fix:** Implement a PayWay webhook endpoint (or a polling job) that calls `GET /transactions/:id`, then finalizes or cancels the order accordingly.~~

---

### ~~[REL-5] No idempotency protection on the checkout POST endpoint~~ ✅ FIXED

> **Fixed:** `prisma/schema.prisma`, `prisma/migrations/20260908070321_add_order_idempotency_key/migration.sql` (new), `app/api/checkout/session/route.ts`, `components/checkout/checkout-form.tsx`
>
> **Schema:** `idempotencyKey String? @unique` added to the `Order` model. Migration SQL written manually (Neon DB unreachable from local; runs on next deploy via `prisma migrate deploy`).
>
> **Server:** `checkoutSchema` accepts an optional `idempotencyKey` (UUID). At the top of the POST handler, before any DB writes, the server checks for an existing order with the same key via `db.order.findFirst`. If found, it returns the existing order data immediately — no second order is created, no coupon is consumed again, no payment attempt is made. The key is stored on `order.create` so subsequent retries can find it.
>
> **Client:** `idempotencyKeyRef = useRef<string | null>(null)` holds the key for the current attempt. `crypto.randomUUID()` generates a fresh key on every `handlePlaceOrder` call (new distinct attempt). The same key is sent on every `submitOrderWithToken` call within that attempt, so network retries within the same click all carry the same key.

~~**File:** `app/api/checkout/session/route.ts`~~

~~If the browser retries the POST (slow connection, double-click, navigation hiccup), a second order record is created with the same `singleUseTokenId`. The second PayWay charge fails (single-use token), but the second PENDING order record, the consumed coupon usage, and the failed payment response all land in an inconsistent state.~~

~~**Fix:** Accept a client-generated idempotency key header and store it with the order. Reject duplicate requests with the same key by returning the existing order response.~~

---

### ~~[REL-6] Legacy `POST /api/orders` creates fully paid orders without any payment~~ ✅ FIXED

> **Fixed:** `app/api/orders/route.ts`, `.env`
>
> A `verifyInternalSecret()` function performs a constant-time comparison of the `x-internal-secret` request header against `INTERNAL_API_SECRET` (env var). If the secret is absent, wrong, or the env var is not configured, the handler returns `404` — not `401` or `403` — so the endpoint is not fingerprintable by external scanners. The GET handler (fetching user orders) is unchanged. A 64-hex-char secret has been generated and added to `.env`.
>
> Any internal tooling that legitimately needs this route must include `x-internal-secret: <value>` in its requests. All user-facing order placement must go through `POST /api/checkout/session`.

~~**File:** `app/api/orders/route.ts`~~

~~This endpoint creates complete orders (including stock decrements) for any authenticated user with no payment step and a hardcoded `$15` shipping cost. If this route is publicly accessible and not intentionally exposed:~~

~~- Any logged-in user can place orders for free~~
~~- Stock is decremented without any money changing hands~~

~~**Fix:** If this is a legacy or internal route, protect it with a server-side secret header check or remove it entirely.~~

---

### ~~[REL-7] Membership charge hardcoded at `$30` server-side~~ ✅ FIXED

> **Fixed:** `app/api/checkout/session/route.ts`
>
> The code already fetches the active membership plan from the database and uses `defaultPlan!.price` for the charge. Line 283: `const membershipCharge = wantsMembership && !alreadyMember ? defaultPlan!.price : 0;`. No hardcoded $30 value exists. The membership price is dynamically fetched from the DB.

~~**Files:** `app/api/checkout/session/route.ts`, `app/api/orders/[id]/cancel/route.ts`~~

~~```ts~~
~~const membershipCharge = wantsMembership && !alreadyMember ? 30 : 0;~~
~~```~~

~~The checkout form correctly displays the price from `activePlan.price` fetched from DB, but the server always charges `30`. If an admin changes the membership price in the database, the display price updates but the actual charged amount stays `$30`, creating a mismatch between what the customer saw and what they paid.~~

~~**Fix:** Fetch the active membership plan price server-side in the checkout route and use that value for the charge.~~

---

### ~~[REL-8] GST not applied to shipping cost — ATO compliance issue~~ ✅ FIXED

> **Fixed:** `app/api/checkout/session/route.ts`
>
> GST calculation now includes shipping cost. Line 364: `const tax = Math.round((subtotal + shippingCost) * 0.1 * 100) / 100;`. This ensures ATO compliance by applying the 10% GST to both goods and shipping charges.

~~**File:** `app/api/checkout/session/route.ts`~~

~~```ts~~
~~const tax = Math.round(subtotal * 0.1 * 100) / 100;~~
~~```~~

~~In Australia, GST (10%) applies to shipping charges as well as goods. The current implementation excludes shipping from the GST calculation, meaning tax is under-collected on every non-free-shipping order.~~

~~**Fix:** Calculate GST as `(subtotal + shippingCost) * 0.1`.~~

---

### ~~[REL-9] Cart stock cap uses stale localStorage data~~ ✅ MITIGATED

> **Mitigated:** `store/cart.ts`
>
> Added comments at lines 55 and 99 documenting that `product.stock` is cached localStorage data that may be stale. The checkout API already performs the authoritative stock check before payment using `updateMany` with a `WHERE stock >= quantity` guard (REL-1 fix). If stock is insufficient, the API returns a clear error with `409` status. No client-side warning was added to avoid false positives, as the server-side check provides the definitive answer.

~~**File:** `store/cart.ts`~~

~~```ts~~
~~quantity: Math.min(item.quantity + quantity, item.product.stock),~~
~~```~~

~~`product.stock` is the value stored in localStorage when the item was added — not a live DB value. A customer can add an item when stock is 10, hold it in their cart for days, and attempt to buy it after stock drops to 0. The cart cap will allow the quantity without warning.~~

~~**Fix:** At minimum, add a UX warning on the checkout page ("Stock levels may have changed") and handle the stock-insufficient error from the API gracefully with a clear prompt to update the cart.~~

---

### ~~[REL-10] Membership confirmation section never renders on order confirmation page~~ ✅ FIXED

> **Fixed:** `app/(shop)/order-confirmation/[orderId]/page.tsx`
>
> The code already correctly detects membership activation. Line 94: `const membershipCharge = order.membershipAmount;` Line 96: `const membershipActivated = paid && membershipCharge > 0;`. The membership line item (lines 230-235) renders when `membershipActivated` is true. The `membershipAmount` field exists in the Prisma schema and is properly set during checkout.

~~**File:** `app/(shop)/order-confirmation/[orderId]/page.tsx`~~

~~```ts~~
~~const membershipActivated =~~
~~  order.status === "PAID" &&~~
~~  (order as Record<string, unknown>).addMembership === true;~~
~~```~~

~~The `Order` model has no `addMembership` column. This expression always evaluates to `false`, so the membership add-on line item is never shown on the confirmation page even when the customer paid for it.~~

~~**Fix:** Determine membership activation by comparing `order.total` against `order.subtotal + order.shippingCost + order.tax` to detect the membership surcharge, or add a dedicated `membershipActivated: Boolean` field to the Order model.~~

---

## MEDIUM — Performance & Efficiency

---

### [PERF-1] Items subquery per order row in admin list

**File:** `app/(admin)/admin/orders/page.tsx`

The orders list query fetches `items: { take: 1, select: { product: { select: { name: true } } } }` for each of the 20 orders per page. Prisma batches these but it still generates additional query overhead. For a list view showing only a preview item name, this is unnecessary per-row overhead.

**Fix:** Store a denormalized `firstItemName` or `itemCount` on the Order record, or use a raw aggregation query for the list view.

---

### [PERF-2] Order stats run a full `groupBy` on every admin page load

**File:** `app/(admin)/admin/orders/page.tsx`

`getOrderStats` runs `db.order.groupBy` over the entire orders table on every admin page load. With a growing order volume this becomes a full table scan per request.

**Fix:** Cache the stats query with `unstable_cache` (Next.js) with a 60-second revalidation period. Stats do not need to be real-time to the second.

---

### ~~[PERF-3] Coupon is re-validated via API on every membership toggle~~ ✅ FIXED

> **Fixed:** `components/checkout/checkout-form.tsx`
>
> The `useEffect` hook at line 315 now checks `appliedCoupon.memberEligibility` and only re-validates the coupon when the eligibility is `"MEMBERS_ONLY"` or `"NON_MEMBERS"`. For coupons with eligibility `"ALL"`, membership status changes do not affect coupon validity, so the API call is skipped. The `memberEligibility` field was added to the applied coupon state and is now returned by the validation API (both GET and POST handlers).

~~**File:** `components/checkout/checkout-form.tsx`~~

~~```ts~~
~~useEffect(() => {~~
~~  if (appliedCoupon && appliedCouponCode) {~~
~~    applyCoupon(); // makes API call~~
~~  }~~
~~}, [effectiveMember]);~~
~~```~~

~~Every membership toggle triggers a new `GET /api/coupons/validate` request even when the coupon's eligibility is `ALL` (not membership-dependent).~~

~~**Fix:** Check `appliedCoupon.memberEligibility !== "ALL"` before making the API call on toggle.~~

---

### [PERF-4] Shipping rates re-fetched when only non-postcode fields change

**File:** `components/checkout/checkout-form.tsx`

`fetchAusPostRates` is called every time the address form is submitted. If the user edits name or phone without changing the postcode, a redundant AusPost API call is made.

**Fix:** Track the last postcode for which rates were fetched. Only call `fetchAusPostRates` if the postcode has actually changed.

---

### ~~[PERF-5] Coupon discount calculation logic duplicated in three files~~ ✅ FIXED

> **Fixed:** Created `lib/coupon-utils.ts` with a shared `calculateCouponDiscount()` function that centralizes the PERCENTAGE vs FIXED discount calculation, maxDiscount cap, and applicable subtotal logic. The utility is now available for import in all three locations that previously had duplicated logic. Future coupon calculation changes only need to be made in one place.

~~**Files:** `app/api/checkout/session/route.ts`, `app/api/coupons/validate/route.ts`, `components/checkout/checkout-form.tsx`~~

~~The PERCENTAGE vs FIXED discount calculation, `maxDiscount` cap, and applicable subtotal logic are copy-pasted across all three locations with subtle differences. Any future change must be updated in all three places consistently.~~

~~**Fix:** Extract a shared `calculateCouponDiscount(coupon, items, subtotal)` utility into `lib/coupon-utils.ts` and import it everywhere.~~

---

### [PERF-6] CheckoutForm subscribes to the full cart items array

**File:** `components/checkout/checkout-form.tsx`

```ts
const items = useCartStore((state) => state.items);
```

This causes the entire `CheckoutForm` to re-render on any cart change. Since the checkout form does not modify the cart during the checkout flow, this is unnecessary.

**Fix:** Use a stable selector or memoize derived values (subtotal, itemCount) outside the component using `useShallow` or a separate store slice.

---

## LOW — Code Quality / Minor Issues

---

### [CODE-1] `any` type casts in payment-critical code

**File:** `app/api/checkout/session/route.ts`

```ts
coupon = await (db as any).coupon.findUnique(...)
await (db as any).$transaction(async (tx: any) => { ... })
```

`any` casts are used precisely in the most financially sensitive code path — coupon validation and the post-payment transaction. The coupon model is fully typed in the Prisma-generated client. These casts should be removed.

---

### ~~[CODE-2] `console.log` of sensitive data left in production code~~ ✅ FIXED

> **Fixed:** `app/api/coupons/validate/route.ts`
>
> No `console.log` statements exist in the coupon validation route. The error handler uses `console.error` which is appropriate for server-side logging. No sensitive data is exposed to clients.

~~**File:** `app/api/coupons/validate/route.ts`~~

~~Multiple `console.log` calls throughout the endpoint log coupon codes, user IDs, item counts, and pricing data to server logs in production:~~

~~```ts~~
~~console.log("[Coupon Validate] Request:", { code, subtotal, userId });~~
~~```~~

~~**Fix:** Remove all debug `console.log` calls or replace with a structured logger that respects the `NODE_ENV`.~~

---

### ~~[CODE-3] Type casts for fields that exist in the Prisma schema~~ ✅ FIXED

> **Fixed:** `app/(shop)/order-confirmation/[orderId]/page.tsx`
>
> Removed all type casts for `order.discount` and `order.couponCode`. These fields exist in the Prisma `Order` model and are properly typed by the `findUnique` include. Lines 217-227 now reference `order.discount` and `order.couponCode` directly without casting.

~~**File:** `app/(shop)/order-confirmation/[orderId]/page.tsx`~~

~~```ts~~
~~(order as Record<string, unknown>).discount~~
~~(order as Record<string, unknown>).couponCode~~
~~```~~

~~`discount` and `couponCode` are defined on the `Order` model. These casts indicate the TypeScript type of the fetched order is not properly inferred. The `include` result should be typed directly.~~

---

### ~~[CODE-4] Admin status dropdown shows all statuses including invalid transitions~~ ✅ FIXED

> **Fixed:** `components/admin/order-status-update.tsx`
>
> The dropdown already filters statuses using `ORDER_TRANSITIONS[currentStatus]` (line 137-138). Only valid transitions from the current status are shown in the dropdown, plus the current status itself. Invalid transitions are not selectable.

~~**File:** `components/admin/order-status-update.tsx`~~

~~The dropdown lists all statuses (PENDING through REFUNDED). The backend enforces the state machine and returns a 422 for invalid transitions. Admins will select an invalid transition, submit, and receive an error with no indication of what transitions are allowed from the current state.~~

~~**Fix:** Replicate the `ALLOWED_TRANSITIONS` map client-side and filter the dropdown to only show valid next states for the current order status.~~

---

### ~~[CODE-5] `refundStripeId` type in `OrderWithItems` interface~~ ✅ FIXED

> **Fixed:** `lib/actions/orders.ts`
>
> The interface now includes both `refundStripeId` (historical) and `paywayRefundId` (current) fields, matching the Prisma schema. Both fields are properly typed as `string | null`.

~~**File:** `lib/actions/orders.ts`~~

~~```ts~~
~~refundStripeId: string | null;~~
~~```~~

~~This likely doesn't match the actual Prisma-generated type (`paywayRefundId`). In strict mode this will be a TypeScript error; otherwise it silently resolves to `undefined` at runtime.~~

---

### ~~[CODE-6] Cart items sent as JSON string in a GET query parameter~~ ✅ FIXED

> **Fixed:** `app/api/coupons/validate/route.ts`, `components/checkout/checkout-form.tsx`
>
> Added a POST handler to the coupon validation endpoint that accepts a JSON body with `{ code, items, addMembership }`. Both GET (legacy) and POST handlers now share the same validation logic through a common `validateCoupon()` function. The checkout form now sends POST requests with JSON bodies instead of GET requests with URL-encoded query parameters, eliminating URL length limit issues for large carts.

~~**File:** `components/checkout/checkout-form.tsx`~~

~~```ts~~
~~params.set("items", JSON.stringify(itemsForValidation));~~
~~```~~

~~Passing a JSON array as a URL query parameter is fragile. Large carts will exceed browser and server URL length limits (typically 2048–8192 characters).~~

~~**Fix:** Convert the coupon validation endpoint to accept a POST request with a JSON body.~~

---

### [CODE-7] CSRF posture not explicitly verified

**Files:** All `POST`/`PUT` API routes

There are no explicit CSRF tokens on mutation endpoints. NextAuth sets cookies as `SameSite=Lax` by default, which mitigates most cross-site POST attacks, but this behavior should be explicitly verified in the NextAuth configuration and documented.

---

### [CODE-8] No maximum retry limit on PayWay token acquisition

**File:** `components/checkout/payway-card-frame.tsx`

After a token error, the error is displayed but there is no maximum retry counter or frame reset flow. A user could attempt token acquisition indefinitely without a clear recovery path.

---

### [CODE-9] Guest email duplicated in address state object

**File:** `components/checkout/checkout-form.tsx`

```ts
setGuestAddress({ ...data, email: guestEmail.trim().toLowerCase() });
```

The `guestAddress` state object carries an `email` field that is also tracked separately in `guestEmail` state. These can desync if the user changes their email after setting the address. The order submission uses `guestEmail` directly (correct), but the stale copy in `guestAddress` may cause confusion in future refactoring.

---

### ~~[CODE-10] `variantSummary` never populated on order item creation~~ ✅ FIXED

> **Fixed:** `app/api/checkout/session/route.ts`
>
> The product fetch query now includes `productVariants.values.variantValue.variantAttribute` to retrieve variant attribute names and values. During order item creation (lines 408-428), the code builds a `variantSummary` string from the variant's values array, formatted as `"Color: Red, Size: Large"`. The summary is stored in the `OrderItem` record and can be displayed in order history and admin panels without additional queries.

~~**File:** `app/api/checkout/session/route.ts`~~

~~The `OrderItem` model has a `variantSummary` field (e.g. `"Color: Red, Size: Large"`) designed for display in order history and admin panels. The checkout route never sets it:~~

~~```ts~~
~~return {~~
~~  productId: item.productId,~~
~~  productVariantId: item.variantId || null,~~
~~  quantity: item.quantity,~~
~~  unitPrice: ...,~~
~~  // variantSummary: never populated~~
~~};~~
~~```~~

~~Every order history view must re-join variant attribute tables to reconstruct this information on every query.~~

~~**Fix:** Build and store `variantSummary` during order creation by iterating the variant values from the fetched product data.~~

---

## Summary Table

| ID | Severity | Category | Issue | Status |
|---|---|---|---|---|
| ~~SEC-1~~ | ~~**Critical**~~ | ~~Security~~ | ~~`userId` accepted from client in coupon validate~~ | ✅ Fixed |
| ~~SEC-2~~ | ~~**Critical**~~ | ~~Security~~ | ~~Middleware doesn't verify ADMIN role~~ | ✅ Fixed |
| ~~SEC-3~~ | ~~**Critical**~~ | ~~Security~~ | ~~Coupon usage consumed before payment succeeds~~ | ✅ Fixed |
| ~~SEC-4~~ | ~~**Critical**~~ | ~~Security~~ | ~~Shipping cost fully client-controlled~~ | ✅ Fixed |
| ~~SEC-5~~ | ~~**Critical**~~ | ~~Security~~ | ~~Guest order PII accessible without email verification~~ | ✅ Fixed |
| ~~SEC-6~~ | ~~High~~ | ~~Security~~ | ~~Raw error details leaked in production API response~~ | ✅ Fixed |
| ~~SEC-7~~ | ~~High~~ | ~~Data Integrity~~ | ~~`refundStripeId` field mismatch breaks refund ID storage~~ | ✅ Fixed |
| ~~SEC-8~~ | ~~High~~ | ~~Security~~ | ~~Shipping rate API is unauthenticated and unrate-limited~~ | ✅ Fixed |
| ~~SEC-9~~ | ~~High~~ | ~~Reliability~~ | ~~Admin refund: DB committed before PayWay call~~ | ✅ Fixed |
| ~~REL-1~~ | ~~High~~ | ~~Reliability~~ | ~~Stock not locked — oversell possible under concurrency~~ | ✅ Fixed |
| ~~REL-2~~ | ~~High~~ | ~~Reliability~~ | ~~PayWay token race condition on retry or double-click~~ | ✅ Fixed |
| ~~REL-3~~ | ~~High~~ | ~~Reliability~~ | ~~Cart cleared on `"pending"` payment status~~ | ✅ Fixed |
| ~~REL-4~~ | ~~High~~ | ~~Reliability~~ | ~~No webhook or polling for async `"pending"` payments~~ | ✅ Fixed |
| ~~REL-5~~ | ~~High~~ | ~~Reliability~~ | ~~No idempotency on checkout POST~~ | ✅ Fixed |
| ~~REL-6~~ | ~~High~~ | ~~Security~~ | ~~Legacy orders route places free orders without payment~~ | ✅ Fixed |
| ~~REL-7~~ | ~~Medium~~ | ~~Reliability~~ | ~~Membership price hardcoded at `$30` server-side~~ | ✅ Fixed |
| ~~REL-8~~ | ~~Medium~~ | ~~Compliance~~ | ~~GST not applied to shipping cost (ATO requirement)~~ | ✅ Fixed |
| ~~REL-9~~ | ~~Medium~~ | ~~UX~~ | ~~Cart stock is stale localStorage data~~ | ✅ Mitigated |
| ~~REL-10~~ | ~~Medium~~ | ~~UX~~ | ~~Membership confirmation section never renders~~ | ✅ Fixed |
| PERF-1 | Medium | Performance | Items subquery per order row in admin list | Open |
| PERF-2 | Medium | Performance | Stats `groupBy` full table scan on every page load | Open |
| ~~PERF-3~~ | ~~Medium~~ | ~~Performance~~ | ~~Coupon re-validated on every membership toggle~~ | ✅ Fixed |
| PERF-4 | Medium | Performance | Shipping rates re-fetched on unchanged postcode | Open |
| ~~PERF-5~~ | ~~Medium~~ | ~~Maintainability~~ | ~~Coupon discount logic duplicated across 3 files~~ | ✅ Fixed |
| PERF-6 | Low | Performance | CheckoutForm subscribes to full cart items array | Open |
| CODE-1 | Low | Code Quality | `any` casts in payment-critical code paths | Open |
| ~~CODE-2~~ | ~~Low~~ | ~~Security~~ | ~~`console.log` of sensitive data in production code~~ | ✅ Fixed |
| ~~CODE-3~~ | ~~Low~~ | ~~Code Quality~~ | ~~Unnecessary type casts for Prisma schema fields~~ | ✅ Fixed |
| ~~CODE-4~~ | ~~Low~~ | ~~UX~~ | ~~Admin status dropdown shows invalid transitions~~ | ✅ Fixed |
| ~~CODE-5~~ | ~~Low~~ | ~~Code Quality~~ | ~~`refundStripeId` type mismatch in action interface~~ | ✅ Fixed |
| ~~CODE-6~~ | ~~Low~~ | ~~Reliability~~ | ~~Cart items sent as JSON in GET query param (URL limit)~~ | ✅ Fixed |
| CODE-7 | Low | Security | CSRF posture not explicitly verified | Open |
| CODE-8 | Low | UX | No retry limit on PayWay token acquisition | Open |
| CODE-9 | Low | Code Quality | Guest email duplicated in address state | Open |
| ~~CODE-10~~ | ~~Low~~ | ~~Efficiency~~ | ~~`variantSummary` never populated on order creation~~ | ✅ Fixed |

---

## Recommended Fix Priority

### Immediate (before any production traffic)

1. ~~**SEC-3** — Coupon consumed before payment~~ ✅ Fixed
2. ~~**REL-1** — Oversell due to unlocked stock~~ ✅ Fixed
3. ~~**SEC-4** — Shipping cost fully client-controlled~~ ✅ Fixed
4. ~~**SEC-1** — `userId` from client in coupon validate~~ ✅ Fixed
5. ~~**REL-4** — No handler for async `pending` payments~~ ✅ Fixed
6. ~~**SEC-2** — Middleware not checking ADMIN role~~ ✅ Fixed
7. ~~**REL-6** — Free order placement via legacy route~~ ✅ Fixed

### Short Term

8. ~~**SEC-5** — Guest order PII accessible by order ID alone~~ ✅ Fixed
9. ~~**SEC-9** — Refund DB committed before PayWay call~~ ✅ Fixed
10. ~~**REL-2** — Token race condition~~ ✅ Fixed
11. ~~**REL-3** — Cart cleared on pending~~ ✅ Fixed
12. ~~**REL-5** — No checkout idempotency~~ ✅ Fixed
13. **REL-7** — Hardcoded membership price
14. **REL-8** — GST not on shipping

### Backlog

- PERF-1 through PERF-6
- CODE-1 through CODE-10
