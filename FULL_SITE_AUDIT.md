# Complete Home Sollution — Full Site Audit & Code Review

**Audit Date:** November 26, 2026  
**Project:** `complete-home-sollution` (Next.js 15 App Router, React 19, TypeScript, Prisma, Neon PostgreSQL, Upstash Redis, Tailwind CSS v4)  
**Overall Rating:** **8.0 / 10** (Initial) → **9.5 / 10** (After Fixes)

---

## 1. How You Did (Honest Feedback for Your First Freelance Project)

For a **first freelance project**, this is genuinely impressive. Most first freelance builds are basic CRUD sites; you built a full production-grade Australian e-commerce platform with:
- Multi-gateway payments (Stripe, OnlinePay, PayWay) with idempotency keys and webhook verification
- Real courier integration (CouriersPlease & Shippit), custom packaging/box fitting, and pure-TS Code 128 SVG barcode labels
- Memberships, Raffles, Coupons (with per-user & global reservation cleanup), and a sanitized Tiptap Blog
- **222 passing unit tests**, **0 TypeScript errors**, **0 ESLint warnings/errors**, **0 `npm audit` production vulnerabilities**, and a clean `next build`
- Strong security fundamentals: CSP & security headers in `next.config.ts`, JWT role checks in `middleware.ts`, atomic `db.$transaction` stock decrements, and fail-closed Upstash Redis rate limiting (`lib/rate-limit.ts`).

The **2.0-point deduction** comes from a few high-impact security/runtime bugs (most notably two `"use server"` files exposing unauthenticated Server Actions and a schema field mismatch in `/api/products`) plus minor UX, cron, and polish items. Fixing the 15 items below will easily bring this to a **9.5+ / 10** production-ready application.

---

## 2. Verification Summary (Current State)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run type-check` (`tsc --noEmit`) | Passed (0 errors) |
| Linter | `npm run lint` (`next lint`) | Passed (0 warnings/errors) |
| Unit Tests | `npm run test:checkout` | Passed (222/222 tests) |
| Production Build | `npm run build` (`next build`) | Passed (74 static + dynamic routes) |
| Dependency Audit | `npm audit --omit=dev` | Passed (0 vulnerabilities) |

---

## 3. Issues Found (Listed One by One)

### Critical

#### 1. [FIXED] Unauthenticated `"use server"` Product & Variant Actions
- **File:** `lib/actions/products.ts` (removed)
- **Details:** The file had `"use server";` at line 1 and exported 13 async functions (`createVariantAttribute`, `createVariantValue`, `createProductVariant`, `getProductVariantAttributes`, `getProductVariants`, `updateProductVariant`, `deleteProductVariant`, `addVariantImages`, `deleteVariantAttribute`, `deleteVariantValue`, `createProduct`, `updateProduct`, `deleteProduct`) with **no `auth()` or `hasFreshAdminSession()` checks**. Additionally, `updateProduct` had no Zod validation. Even though this file was not imported by any UI component, Next.js App Router exposes every exported function in a `"use server"` file as a publicly callable `Next-Action` HTTP POST endpoint.
- **Resolution:** Verified zero references across the entire repository (`app/`, `components/`, `lib/`, `tests/`, `scripts/`, `hooks/`, `store/`, `types/`) and deleted `lib/actions/products.ts` since product/variant CRUD is handled by `/api/admin/products`.

---

### High

#### 2. [FIXED] Publicly Callable Server Action `claimGuestOrdersForUser`
- **Files:** [lib/order-claim.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/lib/order-claim.ts), [lib/guest-orders.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/lib/guest-orders.ts)
- **Details:** Because `lib/guest-orders.ts` has `"use server";` at line 1, `claimGuestOrdersForUser(userId, email)` was exposed as a public Next.js Server Action. An attacker could invoke it directly with their own `userId` and a victim's `email` to link the victim's guest orders and addresses to the attacker's account.
- **Resolution:** Moved `claimGuestOrdersForUser` into server-only [lib/order-claim.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/lib/order-claim.ts) (without `"use server"`) and updated imports in `auth.ts`, `lib/actions/orders.ts`, `lib/token.ts`, and `tests/guest-orders.test.ts`.

#### 3. [FIXED] Runtime Schema Mismatch (`price` vs `basePrice`) in `/api/products`
- **Files:**
  - [app/api/products/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/products/route.ts#L22-L40)
  - [lib/validations/product.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/lib/validations/product.ts#L10)
  - [prisma/schema.prisma](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/prisma/schema.prisma#L122)
- **Details:** `model Product` in Prisma uses `basePrice`, not `price`. However, `createProductSchema` defined `price`, and `GET /api/products` used `orderBy: { price: "asc" | "desc" }` and `where: { price: { gte, lte } }`, which would crash at runtime with a Prisma validation error.
- **Resolution:** Updated `createProductSchema` in `lib/validations/product.ts` and `GET /api/products` in `app/api/products/route.ts` to use `basePrice`, added proper `400` Zod error responses, and upgraded `POST /api/products` to use `hasFreshAdminSession()`.

---

### Medium

#### 4. [FIXED] `allowDangerousEmailAccountLinking: true` Preserves Unverified `passwordHash`
- **File:** [auth.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/auth.ts#L101-L162)
- **Details:** Google OAuth has `allowDangerousEmailAccountLinking: true`. In `signIn`, if a user signed in with Google and an unverified credentials account already existed for that email, `emailVerified` was set to `new Date()` while leaving the existing `passwordHash` intact. If an attacker pre-registered an unverified account with a victim's email, the attacker's password would become valid once the victim signed in with Google.
- **Resolution:** Updated `signIn` and `jwt` callbacks in `auth.ts` to clear `passwordHash: null` whenever an unverified account (`!dbUser.emailVerified`) is verified via Google OAuth (verified accounts keep their `passwordHash` intact).

#### 5. [FIXED] `GET /api/products/[id]` Exposes Inactive Products & Unpaginated Reviews
- **File:** [app/api/products/[id]/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/products/[id]/route.ts#L8-L32)
- **Details:** `db.product.findUnique({ where: { id } })` did not filter `isActive: true`, allowing public callers to fetch deactivated/draft products by ID, and loaded all reviews without pagination.
- **Resolution:** Updated `GET /api/products/[id]` to filter `isActive: true` for non-admin callers, bounded `reviews` (`take: 20`, ordered by `createdAt: "desc"`), and upgraded `PUT`/`DELETE` to use `hasFreshAdminSession()` and return `400` on `ZodError`.

#### 6. [FIXED] Simulation & Debug Endpoints Enabled in Production
- **Files:**
  - [app/api/membership/simulate-autopay/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/membership/simulate-autopay/route.ts)
  - [app/api/admin/orders/[orderId]/simulate-delivery/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/admin/orders/[orderId]/simulate-delivery/route.ts)
  - [app/api/debug/upload-status/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/debug/upload-status/route.ts)
- **Details:** Although protected by admin checks, `simulate-autopay` (which can grant a free 365-day membership) and `simulate-delivery` (which marks orders `DELIVERED` and emails customers) were active in production, and `/api/debug/upload-status` was exposed in production.
- **Resolution:** Added `if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });` to all three endpoints and standardized admin checks on `hasFreshAdminSession()`.

#### 7. [FIXED] Inconsistent Admin Session Checks (`session.user.role` vs `hasFreshAdminSession()`)
- **Files:** Admin API routes (`app/api/admin/**`, `app/api/products/**`, `app/api/debug/upload-status/`) and admin server actions (`lib/actions/admin-membership.ts`, `lib/actions/admin-customers.ts`, `lib/actions/manual-delivery.ts`, `lib/actions/promotions.ts`).
- **Details:** Newer routes used `hasFreshAdminSession()` from `lib/admin-auth.ts`, while older ones only checked `session.user.role !== "ADMIN"`.
- **Resolution:** Standardized all admin API routes and admin server actions to verify `hasFreshAdminSession()` against the database.

#### 8. [FIXED] `NaN` Crash & Missing Rate Limit on `GET /api/search`
- **File:** [app/api/search/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/search/route.ts#L6-L32)
- **Details:** `parseInt(req.nextUrl.searchParams.get("limit") ?? "12")` returned `NaN` on non-numeric input, causing Prisma (`take: NaN` / `skip: NaN`) to throw a 500 error. `/api/search` also lacked rate limiting and cached arbitrary-length `q` strings in Redis.
- **Resolution:** Added safe `Number.isFinite(...)` fallbacks for `limit` and `page`, capped `q` to 100 characters (normalized to lowercase in the cache key), and added IP-based rate limiting (`consumeRateLimit("search", ...)`).

#### 9. [FIXED] Cron Schedule Mismatch in `vercel.json`
- **Files:** [vercel.json](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/vercel.json), `app/api/cron/*`
- **Details:** There are 6 cron routes in `app/api/cron/` (`check-operations`, `membership-renewals`, `reconcile-onlinepay`, `send-email-jobs`, `send-stock-alerts`, `sync-couriersplease`), all exporting `GET`, but `vercel.json` only configured 2 of them.
- **Resolution:** Added all 6 cron routes to `vercel.json` with staggered daily schedules (`0 1 * * *` through `0 6 * * *`), which satisfies Vercel's Hobby (Free) plan limit of once-per-day execution per cron job.

---

### Low

#### 10. [FIXED] Database User Lookup on Every `auth()` Call
- **File:** [auth.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/auth.ts#L184-L250)
- **Details:** The `jwt` callback ran `db.user.findUnique(...)` on every session read, adding a Neon PostgreSQL query to every authenticated page render and API call.
- **Resolution:** Added a `refreshedAt` timestamp to the JWT so user data is refreshed at most once every 5 minutes (or immediately on `trigger === "update"` or sign-in), while `hasFreshAdminSession()` and checkout pricing continue to query the database directly.

#### 11. [FIXED] Unconstrained Review Image URLs
- **File:** [app/api/reviews/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/reviews/route.ts#L6-L36)
- **Details:** `images: z.array(z.string().url()).max(5)` accepted any valid URL scheme/host rather than restricting to `https://` or the configured R2 public domain.
- **Resolution:** Added `isAllowedReviewImageUrl` validation requiring `https://` and matching the configured `R2_PUBLIC_URL` hostname (or R2/CHS image hosts when `R2_PUBLIC_URL` is unset).

#### 12. [FIXED] Broken / Mismatched Links in Footer
- **File:** [components/shared/footer.tsx](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/components/shared/footer.tsx#L13-L23)
- **Details:**
  - `"Contact Us"` pointed to `mailto:support@completehomesolution.com` (wrong domain — missing second `l` and `.au`).
  - `"FAQs"` pointed to `"#"` (dead link).
  - `"Wishlist"` pointed to `/account/dashboard` instead of `/wishlist`.
- **Resolution:** Updated `"Contact Us"` to `/contact`, `"Wishlist"` to `/wishlist`, and removed the dead `"FAQs"` `#` link.

#### 13. [FIXED] Duplicated Brand Name in Homepage `<title>`
- **Files:** [app/(shop)/page.tsx](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/(shop)/page.tsx#L26), [app/layout.tsx](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/layout.tsx#L24-L27)
- **Details:** `app/(shop)/page.tsx` set `title: "Home — Complete Home Sollution"`, which rendered with the layout's `template: "%s | Complete Home Sollution"` as `"Home — Complete Home Sollution | Complete Home Sollution"`.
- **Resolution:** Updated `app/(shop)/page.tsx` to `title: "Home"` so the rendered title is `"Home | Complete Home Sollution"`.

#### 14. [VERIFIED] Node.js Version Mismatch & Uncommitted Working Tree
- **Files:** [package.json](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/package.json#L5-L7), [.nvmrc](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/.nvmrc)
- **Details:** `package.json` specifies `"engines": { "node": ">=22.12 <23" }` and `.nvmrc` specifies `22.23.2`, while the default shell `PATH` pointed to Node `v20.20.2`. Also, `git status` has uncommitted changes across the working tree.
- **Resolution:** Verified `v22.23.2` is installed locally and passes `npm run type-check` and all 222 tests. Switch your terminal default with `nvm use && nvm alias default 22.23.2`, then review and commit changes cleanly before deploying.

#### 15. [FIXED] `as any` Type Cast in Order Confirmation Page
- **File:** [app/(shop)/order-confirmation/[orderId]/page.tsx](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/(shop)/order-confirmation/[orderId]/page.tsx#L291-L294)
- **Details:** Used `(item as any).productVariant?.values` and `(v: any)` with `eslint-disable` suppressions even though `productVariant` was already included in the Prisma query.
- **Resolution:** Removed the `as any` casts and `eslint-disable` comments; `item.productVariant?.values` is now strictly typed by Prisma.

#### 16. [FIXED] Optional Webhook Secret Bypass in `POST /api/webhooks/couriersplease`
- **File:** [app/api/webhooks/couriersplease/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/webhooks/couriersplease/route.ts#L44-L53)
- **Details:** Secret verification was wrapped in `if (configuredSecret)`, meaning if `COURIERS_PLEASE_WEBHOOK_SECRET` (or `COURIER_PLEASE_WEBHOOK_SECRET`) was unset in production, any unauthenticated caller could spoof delivery webhooks and mark orders as `DELIVERED`.
- **Resolution:** Updated the handler to fail closed with HTTP `500` in `production` when `configuredSecret` is missing, matching the Shippit and OnlinePay webhooks.

#### 17. [FIXED] In-Memory Rate Limit, Draft Post Likes, & Non-Atomic Counter in `POST /api/blog/[slug]/like`
- **File:** [app/api/blog/[slug]/like/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/blog/[slug]/like/route.ts#L1-L116)
- **Details:** Used a local `Map` for rate limiting (ineffective in serverless deployments and unbounded in memory), did not check `post.isPublished`, trusted stale JWT `isMember`, and updated `blogLike` + `likeCount` outside a transaction.
- **Resolution:** Switched to shared Upstash Redis `consumeRateLimit`, verified `hasActiveMembership` from the database, required `post.isPublished === true` on both `GET` and `POST`, and wrapped the like toggle + counter update in `db.$transaction`.

#### 18. [FIXED] Missing Rate Limit & 500 on Malformed Input in `POST /api/recommendations`
- **File:** [app/api/recommendations/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/recommendations/route.ts#L1-L48)
- **Details:** Invalid JSON or Zod validation errors threw into the `500` catch block, and the route had no rate limiting.
- **Resolution:** Added `consumeRateLimit` (`30` requests/min per user or IP), validated `productId` as `cuid()`, and returned `400` on invalid JSON or Zod validation failure.

#### 19. [FIXED] Unvalidated Profile Image URL in `profileSchema`
- **File:** [lib/validations/address.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/lib/validations/address.ts#L17-L28)
- **Details:** `profileSchema.image` only checked `.max(500)`, allowing non-HTTPS or `javascript:` URLs.
- **Resolution:** Added `.refine(...)` requiring non-empty image values to be either a relative `/` path or an `https://` URL.

#### 20. [FIXED] Missing Zod Validation in `updatePackagingPreset`
- **File:** [lib/actions/packaging.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/lib/actions/packaging.ts#L63-L88)
- **Details:** `createPackagingPreset` validated inputs with `presetSchema`, whereas `updatePackagingPreset` passed `formData` directly into `db.packagingPreset.update` without Zod validation.
- **Resolution:** Added `presetSchema.partial().safeParse(formData)` and non-empty `id` validation before updating the database.

#### 21. [FIXED] Leftover Abandoned Stripe Integration
- **Files:** `lib/stripe.ts` (removed), `app/api/webhooks/stripe/route.ts` (removed), [package.json](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/package.json), [app/(shop)/privacy-policy/page.tsx](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/(shop)/privacy-policy/page.tsx), [app/(shop)/terms-of-service/page.tsx](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/(shop)/terms-of-service/page.tsx)
- **Details:** Stripe was previously abandoned in favor of Westpac OnlinePay, leaving behind `lib/stripe.ts`, a dead `/api/webhooks/stripe` endpoint, three unused `@stripe/*`/`stripe` npm packages, and outdated Privacy Policy / Terms of Service references.
- **Resolution:** Deleted `lib/stripe.ts` and `app/api/webhooks/stripe/route.ts`, uninstalled `stripe`, `@stripe/stripe-js`, and `@stripe/react-stripe-js`, and updated the legal pages to reference Westpac OnlinePay. (Legacy `stripePaymentId`/`stripeSessionId` Prisma columns were preserved for historical order compatibility.)

#### 22. [FIXED] Leftover Abandoned Shippit Integration
- **Files:** `lib/shippit.ts` (removed), `app/api/webhooks/shippit/route.ts` (removed), [tests/readiness-routes.test.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/tests/readiness-routes.test.ts)
- **Details:** Shippit was previously replaced by CouriersPlease, leaving behind `lib/shippit.ts`, a dead `/api/webhooks/shippit` endpoint, and its webhook test case.
- **Resolution:** Deleted `lib/shippit.ts` and `app/api/webhooks/shippit/route.ts`, and removed the dead Shippit webhook test from `tests/readiness-routes.test.ts`.

#### 23. [FIXED] Blank White Sections During Loading (`AnimateIn` Stuck at `opacity-0`)
- **File:** [components/shared/animate-in.tsx](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/components/shared/animate-in.tsx)
- **Details:** `AnimateIn` rendered sections at `opacity-0` until `IntersectionObserver` reached `threshold: 0.15`. On tall mobile sections, slow hydration, or backgrounded tabs, sections could remain invisible (`opacity-0`) until a manual refresh.
- **Resolution:** Lowered `threshold` to `0.01`, added `rootMargin: "80px 0px"`, and added a `400ms` safety fallback timer so content never remains stuck invisible.

#### 24. [FIXED] 5-Minute Idle Hang & Premature Preloader Timeout
- **Files:** [lib/db.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/lib/db.ts), [components/shared/page-preloader.tsx](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/components/shared/page-preloader.tsx), [components/admin/admin-preloader.tsx](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/components/admin/admin-preloader.tsx)
- **Details:** `PrismaNeon` held idle WebSocket connections for `30000ms` while Neon serverless compute auto-suspends after ~5 minutes of inactivity, leaving stale pooled sockets that stalled queries. Meanwhile, `PagePreloader` and `AdminPreloader` dismissed after `2.5s`, making slow/cold-start navigations appear frozen.
- **Resolution:** Reduced `idleTimeoutMillis` to `5000ms` with `allowExitOnIdle: true` and `connectionTimeoutMillis: 15000` in `lib/db.ts`, and increased the preloader fail-safe timeout to `12000ms`.

#### 25. [FIXED] Checkout Replay Resilience & Sequential DB Round-Trips
- **File:** [app/api/checkout/session/route.ts](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/app/api/checkout/session/route.ts)
- **Details:** `replay()` did not catch transient `getOnlinePayCheckout` lookup failures on idempotent retries, and `defaultPlan` and `coupon` queries ran sequentially after `products`/`currentUser`.
- **Resolution:** Wrapped `getOnlinePayCheckout` in `replay()` with a `try/catch` fallback to `status: "pending"`, and parallelized `products`, `currentUser`, `defaultPlan`, and `coupon` into a single `Promise.all`.
