# Production readiness audit — 21 September 2026

**Verdict: NOT READY for production. Do not enable live payments yet.**

## Fifth remediation batch — 5 October 2026

The next five unresolved findings were reviewed in report order:

- **P1-12 remains open:** release preflight now validates a deployed HTTPS app origin, matching auth and OnlinePay return origins, 32-character secrets, gateway consistency, and OnlinePay mode. The configured local environment fails because `CRON_SECRET` is missing and the origin is localhost. No staging deployment or provider-dashboard access exists yet, so real webhook, 3DS, refund, and host acceptance cannot be run.
- **P2-01 production dependency triage complete:** `npm audit --omit=dev` reports zero advisories, and CI now gates high-severity production advisories. Full audit still reports one unpatched development-only `braces` advisory propagated through five package entries plus one low `esbuild` advisory. Reachability and review conditions are recorded in [dependency triage](dependency-triage-2026-10-05.md).
- **P2-04 sampled automated failures fixed:** a fresh 390 px Chrome/axe scan of home, products, product detail, cart, and checkout found one remaining stock-label contrast failure. The label was darkened and the [repeat scan](accessibility-rescan-2026-10-05.json) now reports zero violations on all five pages. Keyboard, zoom, and screen-reader acceptance still needs a human pass.
- **P2-06 application monitoring improved:** the protected operations health endpoint now reports overdue payment and fulfillment reviews as well as refund actions and failed notification jobs. Existing outbox, stock-alert retry, Sentry instrumentation, CI, and runbook work remains in place. Delivery of an actual alert, backup restore, rollback, and incident access still require staging acceptance.
- **P2-07 checkout race mitigated:** pending order items now hold inventory. Checkout locks each stock row and subtracts all pending quantities before creating another payable order, so a second normal checkout cannot promise the last unit. Tests cover a competing checkout blocked before provider contact and the existing paid-stock-failure refund action. Stock changed externally after checkout can still cause the refund path; provider funds and merchant acceptance remain unverified.

Verification: TypeScript, lint with existing warnings, `git diff --check`, production-only npm audit, and the normal suite (**78/78**) pass. The pending-stock query executed successfully against the configured database without writes. Local release preflight fails on missing `CRON_SECRET` and a localhost origin; the rollback-only order transaction check cannot reach its assertions because the configured database lacks the earlier `couponReserved` migration column. No deployment, migration, live payment, refund, or alert delivery was performed. The release verdict remains **NOT READY**.

## Fourth remediation batch — 4 October 2026

Five additional open P2 findings received application or release-process fixes in the working tree:

- **P2-04:** named the catalog pagination controls and home breadcrumb; removed the nested shared `<main>` landmark; darkened the primary, destructive, and muted text tokens and improved footer/auth panel text contrast. These changes address the specific control-name and sampled contrast failures. A repeat browser axe, keyboard, zoom, and screen-reader acceptance pass is still required before closing the full accessibility finding.
- **P2-05:** cart display and Buy Again now fetch current active product/variant prices and stock from the catalog API. Reorder skips removed/zero-stock items and caps quantity to current stock. The cart blocks checkout when a current item is unavailable or overstocked and tells the customer when prices changed. Existing checkout still independently refreshes and validates pricing.
- **P2-08:** stock-alert malformed JSON now returns 400 and unknown/inactive products return 404; cart refresh requests are bounded and validated. Checkout bounds billing fields before creating an order or provider session, validates saved addresses to the same schema, and classifies malformed JSON as 400. Coupon preview already uses bounded cart IDs and authoritative DB prices from the preceding batch.
- **P2-09:** Node 20.19+ is declared, setup uses `npm ci` and `.env.example`, CI checks install/type/lint/tests/build, and `release:preflight` checks required configuration, deploys migrations, and performs runtime schema reads. Actual staging migration/host boot still needs execution; the currently configured local environment fails the new configuration gate because `CRON_SECRET` is absent.
- **P2-10:** `/robots.txt` and `/sitemap.xml` now exist. Indexing is opt-in through `SITE_INDEXING_ENABLED=true`; the sitemap includes only active catalog items and public, already-published blog posts. Auth/account/admin/QA, checkout, confirmation, and member-only blog metadata have noindex directives; product/blog pages have canonical URLs and root metadata has a configured origin.

Verification: TypeScript, lint (existing warning backlog), `git diff --check`, and the normal suite (**68/68**) pass. A production build passed with network access for Next.js font downloads; it retains the existing Edge-runtime warning. No migrations were applied and no deployed URL or live payment flow was tested in this batch. The release verdict remains **NOT READY**.

## Remediation update — 24 September 2026

Five findings were fixed in the working tree and covered by the normal regression suite:

- **P0-01 fixed:** `ws` is externalized from the Next.js server bundle. A fresh production build and `next start` returned real database-backed `/api/products` data without `WS_NO_BUFFER_UTIL` and without the masking error. Full intended-host acceptance remains part of P1-12.
- **P1-02 fixed:** `/qa` pages and QA GET/PUT APIs now require a freshly database-confirmed administrator role. QA writes have strict schemas, field bounds, and a 16 KiB body limit.
- **P1-03 fixed:** signed Shippit dispatches validate their schema and atomically transition only `PAID`, `CONFIRMED`, or `PROCESSING` orders. Replays and late events cannot overwrite pending or terminal states or resend notifications.
- **P1-07 fixed:** a shared active-membership predicate, including the exact expiry boundary and legacy no-expiry behavior, is used by home, search, product, category, blog, cart, and checkout pricing/access surfaces.
- **P1-09 fixed:** public blog detail, metadata, related-post, listing, and category-count queries require both `PUBLISHED` status and a publication time that has been reached.

Verification after these changes: TypeScript passes; the normal suite passes **47/47**; lint passes with the existing warning backlog; production build passes; the compiled database-backed catalog runtime check passes. The overall release verdict remains unchanged because the other findings and the deployed acceptance matrix remain open.

### Second remediation batch — 24 September 2026

- **P0-02 fixed:** regular OnlinePay checkout now cancels only explicit provider rejections. Timeouts retain the pending order and original idempotency key; a provider success followed by a local checkout-ID save failure still returns the recovered hosted URL. The existing webhook recovery attaches a verified missing checkout ID before settlement.
- **P1-01 fixed:** new and changed passwords use versioned scrypt (`N=131072`, `r=8`, `p=1`) with random salts. Legacy SHA-256 hashes remain verifiable and are conditionally upgraded after successful authentication; malformed hashes fail closed.
- **P1-04 fixed:** authoritative product/member prices and coupon calculations use integer cents with deterministic remainder allocation. Coupon preview, stored order totals, tax, and OnlinePay line items now use the same calculation; the three-for-$30/$1-off regression stores and charges $31.90 including GST.
- **P1-05 fixed in the working tree:** coupon global and per-user allowance is reserved under a database row lock in the same transaction that creates the pending order. Settlement converts the reservation to usage; confirmed rejection/expiry releases it idempotently. Migration `20260924000100_coupon_reservations` must be deployed before this code is served.
- **P1-06 fixed:** shipping quotes use authoritative packaged dimensions and weight for every quantity, group identical physical parcels, and add matching service prices across all packages. Missing dimensions, parcels over 22 kg, and Australia Post oversize parcels return an explicit manual-freight response instead of silently capping the quote.

Verification after the second batch: Prisma client generation, TypeScript, `git diff --check`, lint, and production build pass; the normal suite passes **57/57**. The build logged expected database DNS failures while prerendering inside the restricted sandbox and completed through the storefront fallbacks. The new migration was generated and validated but was not applied to the configured database during this code session.

### Third remediation batch — 24 September 2026

- **P1-08 fixed:** password accounts now have a complete one-hour reset flow and unverified accounts can request a fresh verification link. Tokens are random, stored only as SHA-256 digests, expire, and are transactionally claimed once. Both request flows use generic account-existence responses, are rate-limited, and revoke newly issued tokens when email delivery fails.
- **P1-10 fixed in the working tree:** reconciliation now selects the next due orders instead of repeatedly selecting the oldest rows, claims work safely across overlapping invocations, processes bounded concurrent batches, and applies capped exponential backoff. Missing provider IDs older than 15 minutes are reported separately for manual/provider-assisted recovery. Migration `20260924000200_reconciliation_schedule` must be deployed before this code is served.
- **P1-11 fixed in application code:** login, registration, password recovery/resend, stock alerts, regular checkout, membership checkout, and uploads use hashed identity keys in a shared Upstash Redis limiter with action-specific limits and `429`/`Retry-After` API responses. Production fails closed when Redis is unavailable; `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must be configured on the deployed service.
- **P2-02 fixed:** published blog HTML is passed through an allowlist sanitizer before rendering. Active elements, event handlers, and unsafe protocols are removed while supported formatting, images, and YouTube embeds are retained; malicious-content regressions are included.
- **P2-03 fixed:** category and contact destinations now exist, registration links target the actual policy pages, and permanent compatibility redirects preserve `/terms` and `/privacy` bookmarks.

Verification after the third batch: Prisma generation, TypeScript, `git diff --check`, lint, production build, and the expanded normal suite pass (**63/63**). Lint retains the pre-existing warning backlog. The build logged expected database DNS failures while prerendering inside the restricted sandbox and completed through storefront fallbacks. The reconciliation migration was generated but was not applied to the configured database.

At audit time the project built and its existing tests passed, but the compiled production server failed database requests in this environment. Independent reproductions also exposed payment recovery, password storage, access control, and order-state defects. A successful build or sandbox checkout creation remains insufficient for launch approval.

This audit covers the current, uncommitted working tree, including the preceding membership/UI repairs. Application code was not changed during this audit. Temporary test tooling and comparison servers were used; the WebSocket workaround described below was applied only to a temporary comparison process. All findings below remain open unless explicitly marked as a passing check.

## Scope and evidence

- Next.js 15.5.25, Prisma 7.10.0, Node 20.20.2; local macOS environment.
- HTTPS development site on localhost:3000, an isolated production build, and temporary production servers on ports 3100/3101.
- Public browsing, desktop/mobile rendering, product-to-cart-to-checkout journey, anonymous API checks, automated accessibility checks, source review, dependencies, and database integration checks.
- No deployed URL was supplied during the audit. Production DNS, certificates, hosting limits, secrets, provider dashboard settings, email delivery, backups, and live payment settlement remain unverified.
- No real card was submitted, no customer order was created, and no emails/SMS were sent by audit actions. Database integration writes were rolled back. Fault reproductions use mocked storage/provider calls. The OnlinePay smoke test created an unpaid sandbox hosted checkout.
- Authenticated member/admin browser journeys, full 3DS, real refunds, and high-concurrency/load tests were not performed. Existing mocked route tests cover portions of these paths; that is not equivalent to browser or live-provider coverage.

### Executed checks

| Check | Result | Evidence / qualification |
|---|---|---|
| Existing automated suite | **43/43 pass** | [automated-tests.txt](automated-tests.txt) |
| TypeScript | Pass | `npm run type-check` |
| Lint | Pass with **138 warnings** before adding audit fixtures | [lint.txt](lint.txt); includes hook dependencies, image optimization, unused code, and `any` |
| Production build | Pass with warnings | [production-build.txt](production-build.txt). Initial sandbox-only DNS failure was resolved by rerunning with network access. |
| Production server database requests | **Fail** | `/api/products` and `/api/qa/results` return 500; WebSocket runtime error. See P0-01. |
| Runtime schema reads | Pass | `npm run check:checkout` |
| Database membership lifecycle | Pass | `npm run check:membership`; all writes rolled back |
| Database order/stock/refund claims | Pass | `npm run check:order-transaction`; all writes rolled back |
| OnlinePay sandbox HPP creation/lookup | Pass | `npm run check:onlinepay`; no card submission/charge |
| Desktop public routes | 17 navigations | [browser-smoke.json](browser-smoke.json); includes expected login redirects and confirmed 404s |
| Mobile smoke checks | 5 routes at 390px | No horizontal overflow in sampled routes; `/membership` resolves to login for anonymous users |
| Anonymous API checks | 15 requests | Protected admin/order/upload/webhook routes reject callers; QA API is public; stock-alert validation returns 500 |
| Guest shopping journey | Pass through checkout entry | Selected product variant added, persisted in cart, then shown at checkout. Stopped before placing an order. |
| Accessibility | **Issues found on all 5 sampled pages** | [accessibility-and-journey.json](accessibility-and-journey.json); findings below |
| npm production dependency audit | **4 high-severity package entries** | [dependency-audit.json](dependency-audit.json). These are related/transitive entries, not four demonstrated website exploits. |
| Targeted defect reproductions | **6/6 reproduced** | [reproduction-results.txt](reproduction-results.txt). A PASS here means the defect was reproduced. |

Additional evidence: [runtime checks](runtime-checks.txt), [sanitized environment snapshot](environment-summary.json), [mobile checkout screenshot](guest-checkout-mobile.png).

## Priority definitions

- **P0 — launch blocker:** core production operation or payment correctness failure.
- **P1 — fix before launch:** significant security, customer-access, financial, or fulfilment defect.
- **P2 — complete before sign-off or document explicit acceptance:** usability, hardening, operational reliability, and verification gaps.

“Reproduced” means exercised by the browser, HTTP request, or isolated fault test. “Source-confirmed” means the implementation demonstrates the issue but a full end-to-end exploit/scenario was not executed. “Unverified” means missing evidence, not a proven deployed failure.

## P0 — launch blockers

### P0-01 — Compiled production server fails database access

**Evidence: reproduced in the isolated production runtime.**

- `next build` succeeds, but `next start --port 3100` returns **500** for `/api/products`.
- Logs show `TypeError: b.mask is not a function`, followed by Prisma `Connection terminated unexpectedly`.
- The same endpoint returns **200** on the development server.
- The same compiled build returns **200** when started with `WS_NO_BUFFER_UTIL=1` on port 3101.
- Relevant configuration: [lib/db.ts](../../lib/db.ts), [next.config.ts](../../next.config.ts). The DB adapter explicitly uses `ws`; the failure is in bundled WebSocket masking.

**Impact:** the site can build and render a shell while catalog, account, and payment database operations fail at runtime.

**Fix:** verify the `ws` bundling/optional native-extension path and choose a tested deployment configuration. Disabling optional bufferutil is a verified narrow workaround in this audit; explicitly externalizing compatible server dependencies is another option to evaluate. Do not treat the workaround as full production validation.

**Acceptance:** a clean install, build, and production start on the intended host must pass catalog, login, order creation, membership settlement, and refund DB operations without masking errors. Verify real DB-backed content, not just HTTP 200 on a page that catches DB errors.

### P0-02 — Regular OnlinePay checkout treats unknown outcomes as definite failure

**Evidence: two isolated fault reproductions.**

- [app/api/checkout/session/route.ts:468](../../app/api/checkout/session/route.ts#L468) unconditionally cancels the order and returns `retryWithNewKey: true` for every hosted-checkout exception.
- Reproduced both a lost provider response and successful hosted checkout creation followed by a failed local checkout-ID save. Both leave the order `CANCELLED` and invite another checkout.
- The safer handling present in the standalone membership checkout is not applied to regular cart checkout (including cart purchases with membership).

**Impact:** the provider may still have a valid checkout while local recovery is disabled. Later payment can be ignored because cancelled orders short-circuit settlement; customer retries can create multiple checkout opportunities. Duplicate payment itself was not executed in this audit.

**Fix:** distinguish a confirmed provider rejection from timeout/unknown/DB-commit outcomes. Preserve uncertain orders as pending, retain the original idempotency key, reconcile provider evidence, and condition cancellation on the order still being pending. Do not return a new-key retry instruction for an unknown outcome.

**Acceptance:** simulate provider acceptance plus network loss, DB save failure, browser retry, early webhook delivery, and delayed success. Exactly one order settles, exactly one entitlement/stock movement occurs, and no second charge is encouraged.

## P1 — issues to fix before launch

### P1-01 — Passwords use a single fast SHA-256 hash

**Evidence: source-confirmed and reproduced.** [lib/password.ts:36](../../lib/password.ts#L36) stores `SHA256(salt + password)`. The reproduction recomputes the stored result with one SHA-256 operation.

**Impact:** a database leak permits fast offline password guessing. Random salts do not supply a password work factor.

**Fix:** use a suitable password hashing function such as Argon2id or scrypt; use versioned hash formats and migrate legacy hashes after successful authentication. Follow [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

**Acceptance:** registration/password changes produce versioned slow hashes; old accounts can authenticate and are upgraded; malformed hashes fail safely; operational work factors are measured.

### P1-02 — Public QA dashboard and unauthenticated QA writes

**Evidence: browser and mocked write reproduction.** Anonymous `/qa` and development `/api/qa/results` return 200. [app/api/qa/results/route.ts](../../app/api/qa/results/route.ts) has no auth guard on GET or PUT. A request with no cookie/header reached mocked `testResult.upsert` and returned 200. No real QA record was changed.

**Impact:** unauthenticated users can inspect internal QA information, falsify results, and grow database storage. Middleware does not cover `/qa` or `/api/qa`.

**Fix:** disable QA routes in production or require fresh administrator authorization for reads and writes. Add strict body limits/schema validation and rate limits.

**Acceptance:** anonymous/customer reads and writes return 401/403 or 404; authorized admin access is tested separately. Never use publicly writable QA results as release evidence.

### P1-03 — Shipping webhook can overwrite refunded/cancelled/payment-pending state

**Evidence: isolated signed-event reproduction.** A valid delayed `dispatched` event changes a mocked `REFUNDED` order to `SHIPPED`. [app/api/webhooks/shippit/route.ts:43](../../app/api/webhooks/shippit/route.ts#L43) updates by ID without a current-state guard.

**Impact:** duplicate or late provider events can corrupt financial/fulfilment state and emit misleading notifications. This requires an accepted signed event; it is not an unauthenticated signature bypass.

**Fix:** validate the event schema, constrain transitions to allowed paid states, preserve terminal financial states, and deduplicate notifications/events.

**Acceptance:** valid delayed/replayed events for pending, cancelled, refunded, and delivered orders cannot move them backwards or bypass payment. A normal paid-to-shipped transition still succeeds once.

### P1-04 — Coupon rounding makes displayed and charged totals disagree

**Evidence: actual checkout handler with mocked provider/database.** Three units at $10 with a $1 fixed coupon produce a stored subtotal of **$29.01**, tax **$2.90**, and total **$31.91**. The client subtracts $1 from $30 and shows **$31.90** including tax.

**Cause:** [checkout route:279](../../app/api/checkout/session/route.ts#L279) rounds discounted unit prices before multiplying quantity; [checkout form](../../components/checkout/checkout-form.tsx) subtracts the coupon at subtotal level.

**Fix:** use integer cents and a deterministic allocation of discount remainders. Derive client review totals and provider line items from the same authoritative calculation.

**Acceptance:** fixed/percentage/category/product coupons, caps, multiple quantities, member prices, and fractional-cent allocation all produce identical displayed, stored, and gateway totals.

### P1-05 — Coupon limits are not enforced atomically across outstanding payments

**Evidence: source-confirmed.** Limits are checked before hosted payment creation. During settlement, [poll-payment route:218](../../app/api/orders/[id]/poll-payment/route.ts#L218) conditionally increments global usage but ignores the returned update count, and does not atomically claim the per-user allowance.

**Impact:** multiple outstanding checkouts can all receive a limited coupon, pay, and settle even after its allowance is exhausted.

**Fix:** reserve/claim coupon allowance atomically using a documented expiry and release policy. Handle already-paid excess-use outcomes explicitly; do not silently discard usage accounting.

**Acceptance:** concurrent checkout/settlement tests with global limit 1 and per-user limit 1; only the allowed discount is offered/charged, including retries, failures, and abandoned reservations.

### P1-06 — Furniture shipping is quoted as one small capped parcel

**Evidence: source-confirmed.** [lib/auspost.ts](../../lib/auspost.ts) fixes dimensions at **30 × 30 × 30** and caps weight at **22 kg**. [checkout route](../../app/api/checkout/session/route.ts) caps item quantities at 20 for weight calculations even though checkout allows 100, and caps the final quote weight at 22 kg.

**Impact:** larger/heavier furniture and multi-item orders can receive an unsuitable parcel quote. A successful quote does not establish that the real goods can ship at that price.

**Fix:** use actual packaged dimensions, total quantities, package splitting, and a freight/provider policy for oversized goods. Block unsupported destinations/items rather than silently reducing dimensions/weight.

**Acceptance:** quote representative sofas, large tables, >22 kg carts, >20 quantities, remote postcodes, and multiple packages against the chosen carrier's accepted shipment definitions and merchant pricing policy.

### P1-07 — Expired membership is treated differently across shopping pages

**Evidence: source-confirmed.** Product listing, product details, category, and home reads use only `isMember` in [products page](../../app/(shop)/products/page.tsx), [product details](../../app/(shop)/products/[slug]/page.tsx), [category page](../../app/(shop)/categories/[slug]/page.tsx), and [home page](../../app/(shop)/page.tsx). Cart/checkout correctly also test expiry.

**Impact:** a lapsed user can see member pricing in parts of the store and lose it at checkout. The server payment route's expiry check prevents this from proving an unauthorized charged discount.

**Fix:** use one shared active-membership predicate everywhere and refresh user-facing membership state consistently.

**Acceptance:** future expiry, exact expiry boundary, expired-but-flagged users, and legacy no-expiry grants show consistent prices across home, product, cart, checkout, and payment.

### P1-08 — Account recovery and expired verification recovery are incomplete

**Evidence: source-confirmed.** [forgot-password page](../../app/(auth)/forgot-password/page.tsx) says password reset is “coming soon.” [lib/token.ts](../../lib/token.ts) tells an expired verification user to register again, but [register/actions.ts](../../app/(auth)/register/actions.ts) rejects an existing email. No resend-verification flow was found.

**Impact:** password users cannot self-recover; unverified accounts can become stuck after 24 hours.

**Fix:** implement expiring single-use reset/resend tokens, throttling, generic account-existence responses, and safe token consumption. Ensure sending failures do not leave an unrecoverable account.

**Acceptance:** expired/used/invalid tokens, unknown addresses, repeated requests, email delivery failure, and successful recovery are covered without leaking account existence unnecessarily.

### P1-09 — Unpublished blog content is available by slug

**Evidence: source-confirmed, not exercised against real draft content.** Both the detail lookup and metadata lookup in [blog/[slug]/page.tsx:100](../../app/(blog)/blog/[slug]/page.tsx#L100) query by slug without requiring `status: PUBLISHED`. The page only adds a membership check. Listing filters do not protect direct URLs.

**Impact:** guessed/shared draft or archived slugs can disclose unpublished content or metadata.

**Fix:** require public publication state/date for anonymous readers; implement an explicitly authenticated admin preview path if needed.

**Acceptance:** draft, archived, and scheduled-future posts return 404 to public/member users in HTML, metadata, and server-component responses; authorized preview remains isolated.

### P1-10 — Reconciliation can repeatedly process the same oldest orders

**Evidence: source-confirmed.** [cron/reconcile-onlinepay](../../app/api/cron/reconcile-onlinepay/route.ts) takes the oldest 20 pending orders by creation time each run, with no last-checked scheduling/cursor. It only includes orders that already have an OnlinePay ID and processes them sequentially.

**Impact:** 20 long-lived pending orders can prevent newer paid orders from reaching reconciliation. Unknown checkout creation outcomes without a recorded provider ID are excluded. Slow provider calls can consume the host's execution limit.

**Fix:** schedule by next-check/last-check timestamps or cursor, apply bounded concurrency/backoff, track stuck orders separately, and define provider-verified/manual recovery for missing IDs. Configure and monitor scheduler authorization and actual host execution limits.

**Acceptance:** seed more than one batch, keep the oldest batch pending, and verify newer paid orders settle promptly. Test provider downtime, missing IDs, overlapping cron runs, and timeout recovery.

### P1-11 — Abuse controls are not suitable for multiple production instances

**Evidence: source-confirmed.** [lib/rate-limit.ts](../../lib/rate-limit.ts) uses a process-local Map for password login; registration, stock alerts, hosted-checkout creation, and upload routes lack comparable distributed limits.

**Impact:** limits reset on restart and are not shared between instances. Public/low-cost account creation or checkout requests can consume DB, provider, email, and storage resources.

**Fix:** use a shared limiter with validated identity/IP inputs and per-action limits, including membership and guest checkout. Define responses and retries without exposing secrets.

**Acceptance:** the same client hitting two instances shares a limit; auth, registration, payment-session creation, and upload have bounded request/body rates. Normal checkout retry/idempotency still works.

### P1-12 — Live deployment configuration and full payment acceptance are unverified

**Evidence: configuration snapshot / missing deployment evidence.** This audit uses `ONLINEPAY_MODE=test` and localhost URLs. `CRON_SECRET` is absent in the snapshot. A real paid card/3DS cycle, externally delivered webhook, provider dashboard setup, and scheduled reconciliation were not exercised. A configured secret is not evidence that the provider knows it or that a scheduler sends it.

**Fix:** supply staging/deployed URL, verify production secrets/return origins, configure provider webhooks and scheduled authorization, and perform the acceptance matrix below before enabling live credentials. The current local test configuration is appropriate for development; this finding does not claim the deployed host uses those same values.

**Acceptance:** signed-in/guest purchase, membership-only purchase, combined cart+membership, 3DS success/failure/cancel, closed-tab recovery, delayed/duplicate notifications, and approved partial/full refunds all reconcile on the intended hosting environment.

## P2 — hardening, customer experience, and operational gaps

### P2-01 — Production dependency advisories need triage

**Evidence: executed npm audit.** Four high-severity package entries: `prisma`, `@prisma/config`, `deepmerge-ts`, and `mysql2`. Related advisories include [DeepmergeTS recursive-graph exhaustion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [MySQL2 auth downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), and [MySQL2 compressed-protocol exhaustion](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3).

**Impact/qualification:** npm's package severity is not a demonstrated reachable website exploit. This app uses PostgreSQL/Neon, not MySQL. Determine which Prisma CLI/config dependencies enter the deployed runtime. The automated suggested fix is a major Prisma version change/downgrade; do not apply it blindly.

**Fix / acceptance:** document reachability, update/remove vulnerable transitive code where supported, and rerun clean build, database migration, checkout, and audit checks. Record explicit justification for any retained advisory.

### P2-02 — Blog HTML is not sanitized before rendering

**Evidence: source-confirmed.** Admin blog APIs trim/truncate HTML, and [blog detail](../../app/(blog)/blog/[slug]/page.tsx) renders processed content using `dangerouslySetInnerHTML`. The content transformation does not remove scripts/event handlers/unsafe links. The global CSP permits inline script.

**Impact/qualification:** stored active content is possible through an authorized publishing/import path; an unauthenticated write bypass was not found or tested. Compromised publishing credentials or unsafe imported HTML can affect readers.

**Fix / acceptance:** apply an allowlist HTML sanitizer appropriate to supported rich-text/YouTube features; strip active event attributes and unsafe protocols. Test representative malicious HTML and retain legitimate formatting. Review CSP after measuring actual integrations.

### P2-03 — Broken browse, support, and registration policy links

**Evidence: browser/HTTP confirmed 404s.**

| Broken URL | Existing caller | Expected destination/action |
|---|---|---|
| `/categories` | Home “categories” CTA and search page | Implement category index or link to an existing browsing page |
| `/contact` | Both order-details support sections | Working support/contact page |
| `/terms` | Registration terms link | `/terms-of-service` or supported redirect |
| `/privacy` | Registration privacy link | `/privacy-policy` or supported redirect |

**Fix / acceptance:** correct links/redirects and run an automated internal-link crawl. Verify registration users can open policies and paying customers can reach support.

### P2-04 — Accessibility: unnamed controls and low contrast

**Evidence: axe checks at 390 × 844.** All five sampled pages report contrast issues. Product listing has **two unnamed buttons** (axe impact “critical”); product detail has an unnamed home/breadcrumb link. Examples include primary red on white around 4.1:1 for small text and footer text around 2.64:1. These are automated findings, not a full accessibility conformance assessment.

**Fix:** label icon-only pagination/buttons/links, adjust text/background combinations, and remove duplicate/nested main landmarks from shared shell/page structure. The first journey script encountered two `<main>` elements; the script was corrected and the journey then passed.

**Acceptance:** repeat axe with no unresolved serious/critical issues, keyboard-only checkout, visible focus, screen-reader field/error labels, zoom at 200%, and mobile dialogs. See exact selectors and rule references in [accessibility-and-journey.json](accessibility-and-journey.json).

### P2-05 — Cart/reorder can show stale prices and fabricated stock

**Evidence: source-confirmed.** [buy-again-button.tsx](../../components/shop/buy-again-button.tsx) inserts historical `unitPrice` as current product price and sets `stock: 99`; it does not supply current member pricing. [cart-page.tsx](../../components/shop/cart-page.tsx) reads persisted prices, while checkout refreshes them.

**Impact:** products previously discounted can appear incorrectly priced/available until checkout. Checkout's authoritative refresh reduces payment risk but leaves a surprise for the customer.

**Fix / acceptance:** fetch current active product/variant price, membership price, and stock before reorder or cart display. Test changed price, expired membership, removed variant, zero stock, and quantity reductions. Explain price changes before payment.

### P2-06 — Limited monitoring, retries, and recovery evidence

**Evidence: source review / unverified infrastructure.** Sentry packages and DSN variables exist, but no Sentry initialization/instrumentation files were found. No application health endpoint or repository CI workflow was found. Payment confirmation notifications execute after settlement and failures are caught; already-paid retries return early, so notification retries are not durable.

**Impact:** payment/provider/DB failures and missing customer receipts can go unnoticed or require manual reconstruction. External host monitoring may exist; it was not available to verify.

**Fix:** establish durable notification jobs/outbox with idempotent retry, error reporting, alerting on paid-but-unfulfilled/stuck/refund-required orders, and health/readiness checks that prove required dependencies. Add CI gates for the existing tests, production boot checks, dependencies, and browser journeys.

**Acceptance:** inject DB/provider/email failures and demonstrate an alert, owner/runbook, and successful retry without duplicate receipts or financial actions. Prove rollback, backup restore, log retention/redaction, and production incident access.

### P2-07 — Stock can disappear after payment; manual refund path needs acceptance

**Evidence: source-confirmed existing fallback.** Regular checkout checks stock before HPP creation but does not reserve it. Settlement decrements stock; if another customer took the last unit, the order becomes cancelled with `refundRequested: true` after the provider has approved payment.

**Impact:** a paying customer may not receive goods and needs a manual refund. The code records the exception rather than silently overselling, but operational completion is unverified.

**Fix / acceptance:** adopt explicit inventory reservations with expiry, or prove a reliable paid-stock-failure refund workflow and merchant acceptance of that policy. Run two payments for the last unit and verify stock, both customer outcomes, refund alerting, and actual returned funds.

### P2-08 — Incorrect error classification and incomplete public API validation

**Evidence: HTTP/source confirmed.** `POST /api/stock-alerts` with `{}` returns **500** for a validation error. Coupon preview parses arbitrary `items` JSON without a shape schema and trusts client prices/subtotal for its displayed discount, while checkout recalculates from DB. Regular checkout billing fields have no upper lengths even though the provider address helper rejects >120 characters.

**Impact:** invalid requests look like server incidents; preview totals/eligibility can disagree with checkout; oversized billing details fail late.

**Fix / acceptance:** use shared bounded request schemas, return 400/422 for malformed data, and derive coupon previews from authoritative prices. Test malformed JSON, wrong types, oversized strings, invalid quantities, unknown products, and long addresses before creating any order/provider session.

### P2-09 — Reproducible deployment and migration gates are not established

**Evidence: source/working-tree review.** New migration/test files are currently untracked; many application files are modified. Build scripts do not run migrations or a schema-read check. Fresh development startup now expects certificate files that are intentionally not committed. The package declares no Node engine constraint, and build logs warn about an Edge-runtime dependency path through `jose`.

**Impact:** a deployment made from an incomplete commit, incompatible runtime, or without migrations may omit the very fixes this audit tested. The current local schema is healthy, which does not prove a new environment can be created safely.

**Fix / acceptance:** commit/review the intended release including migrations, pin supported runtime/tool versions, document certificate generation for developers, and run a staged `migrate deploy` plus runtime schema checks before serving the release. Verify a fresh checkout/install/build and production authentication on the actual hosting runtime. Do not automatically run destructive `db push` in production.

### P2-10 — Search indexing and metadata need a deployment review

**Evidence: browser/source.** `/robots.txt` and `/sitemap.xml` return 404. Root metadata broadly sets `index: true`, and there is no explicit `metadataBase`. Some product/content titles duplicate the store name. QA routes are currently reachable.

**Impact/qualification:** missing robots/sitemap does not stop sales; it leaves indexing policy and discovery incomplete. Authentication is the security control for private pages, not robots directives.

**Fix / acceptance:** add a canonical public-origin metadata configuration, sitemap of public published pages, and appropriate noindex policies for staging, auth, QA, and sensitive confirmation surfaces. Check canonical/OG URLs on the deployed domain and ensure metadata cannot expose unpublished content.

### P2-11 — Customer promises and business-rule acceptance are incomplete

**Evidence: source review / required sign-off.** Stock-alert API stores subscriptions, but no notification consumer was found in the application. Product prices, GST rows, shipping, membership fees, and discounts have multiple independently implemented presentations. A cart UI and checkout amount mismatch has already been reproduced for coupons.

**Fix / acceptance:** connect stock alerts to a durable restock notification workflow or remove the promise. Obtain merchant/accounting approval for the intended price/tax/shipping/membership presentation and verify receipts, refunds, and provider line items use that same model. This audit did not assess tax/legal compliance or validate policy text against business operations.

## Required release acceptance matrix

Record actual environment, order/reference identifiers in a private test record, expected/actual outcome, owner, date, and evidence for each row. Do not put customer details, tokens, or card data into this public repository report.

| Area | Required cases | Launch evidence |
|---|---|---|
| Production boot | Clean install/build/start; catalog/account/checkout DB access | No runtime errors; expected data present |
| Authentication | Register, verify, login, logout, Google callback, password reset, expired verification | Browser and real email delivery; no enumeration/token reuse |
| Authorization | Anonymous, owner, other customer, expired member, admin, demoted admin | Every read/write action has expected access; private data isolated |
| Prices | Regular/member/expired member, product/variant, stale cart, buy-again, coupons and quantities | Display = stored order = provider cents |
| Membership | Standalone, combined cart, duplicate notifications, expiry, refund, simultaneous checkout | One paid entitlement with purchased duration; correct revocation |
| Payments | Approved/declined/cancelled/3DS, timeout, lost response, DB failure, closed tab | Unknown outcomes preserved/reconciled; no double settlement |
| Inventory | Last unit, simultaneous payment, invalid/removed variant, cancellation/refund | No negative stock; clear refund outcome after stock failure |
| Coupons | Global/per-user limit race, date/minimum/cap, category/product restrictions | Atomic allowance and exact cents allocation |
| Shipping | Small parcel, oversized furniture, heavy/multiple parcels, remote/invalid address | Provider-supported services and actual merchant rates |
| Refunds | Partial then remaining, duplicate/racing request, provider pending/timeout, DB failure | Provider money movement matches cumulative local refund |
| Notifications | Payment/shipping/refund email, SMS if enabled, failure/retry | Durable delivery tracking and no duplicate sends |
| Operations | Cron authorization, large pending backlog, alerts, backup restore, rollback | Named owner, alert received, restoration and rollback demonstrated |
| UX/accessibility | Desktop/mobile, keyboard, zoom, screen reader, links, errors | No blocking journeys or unresolved serious control-label defects |
| Deployment | Domain TLS, OAuth origins, webhook URL/secret, live credentials, migrations | Verified on actual host; staging isolated and not indexed |

## Recommended fix order

1. Resolve production runtime failure and regular-checkout unknown-outcome handling.
2. Replace password hashing, close QA access, and protect shipping state transitions.
3. Unify pricing/coupon cents, coupon concurrency, shipping rules, and active-membership checks.
4. Complete recovery flows and protect unpublished content; make reconciliation fair and observable.
5. Fix broken links/accessibility, operational retries/alerts, and dependency/deployment gaps.
6. Execute the full acceptance matrix on staging. Enable live payments only after P0/P1 findings are closed and P2 items have fixes or explicit documented release acceptance.

## Reproducing this audit

Standard repository checks:

```bash
npm run test:checkout
npm run type-check
npm run lint
npm run build
npm run check:checkout
npm run check:membership
npm run check:order-transaction
npm run check:onlinepay
npm audit --omit=dev --json
```

Run `build` in an isolated checkout or stop the development server first to avoid sharing `.next`. Database checks target the configured database; the membership/order scripts roll back test writes. `check:onlinepay` requires test mode and creates an unpaid hosted checkout.

The defect reproductions are separate from passing regression tests:

```bash
node --import tsx --test reports/production-audit-2026-09-21/reproduce-findings.test.ts
```

**Important:** these six tests assert the current faulty behavior so the findings are reproducible. Once fixed, replace the assertions with desired safe behavior and move the resulting regressions into the normal suite. Do not count six passing defect reproductions as six healthy features.

Browser tooling was installed temporarily via npm's execution cache, without changing package manifests. Browser JSON contains routes/statuses/selectors, not authentication tokens or customer data. The screenshot is from a fresh anonymous browser context.

## Final release decision

**Hold release.** Existing tests, local schema health, and unpaid sandbox checkout creation are positive evidence, but they are outweighed by reproduced production/payment/security failures. This report is an engineering audit of the available code and local runtime, not a guarantee that every bug has been found or a certification of a deployed production environment.
