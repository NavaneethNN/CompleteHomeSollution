🚨 Order Functionality Audit Report

Security, Bug & Performance Review

Branch: feat/security-and-performance

Audited Files

app/api/orders/**

app/api/checkout/session/route.ts

app/api/webhooks/stripe/route.ts

app/api/webhooks/shippit/route.ts

lib/actions/orders.ts

lib/order-status-notifications.ts

lib/stripe.ts

prisma/schema.prisma

All Admin & Customer Order pages/components

🔴 Critical Security Issues

S-1. Shippit Webhook Has No Signature Verification

File: app/api/webhooks/shippit/route.ts

Severity: 🔴 Critical

Impact

Any attacker can send fake POST requests.

Orders can be marked as SHIPPED.

Fake tracking numbers can be injected.

Customer notifications can be triggered.

Order state can be manipulated.

Recommended Fix

Use HMAC signature verification with SHIPPIT_WEBHOOK_SECRET.

S-2. Admin Order Detail Page Missing Authentication

File: app/(admin)/admin/orders/[id]/page.tsx

Severity: 🔴 Critical

Fix

const session = await auth();

if (!session || session.user.role !== "ADMIN") {
  redirect("/login");
}

S-3. Order Status Route Has No State Machine

Implement allowed order status transitions to prevent invalidtransitions such as:

REFUNDED → PAID

CANCELLED → SHIPPED

S-4. JWT Used For Member Pricing

Do not use JWT as the source of truth for pricing. Always fetch currentmembership status from the database.

S-5. Customer API Returns Entire Product Object

Expose only required product fields using select.

S-6. Email Templates Use Unsanitized HTML

Escape all user-controlled values before rendering HTML.

S-7. Unlimited Search Input

Limit search length before querying the database.

const safeSearch = search.slice(0, 100);

🟠 High Priority Bugs

B-1. Stock Never Decrements

Use a database transaction and decrement stock atomically.

B-2. Stripe Refund Happens Before DB Transaction

Correct flow:

Commit database transaction.

Process Stripe refund.

Save Stripe refund ID.

B-3. Coupon Race Condition

Use an atomic database update to enforce coupon usage limits.

B-4. getOrders() Has No Pagination

Use take and skip to paginate results.

B-5. CONFIRMED Status Is Dead Code

Either remove the status or implement its workflow.

🟡 Performance Issues

P-1. Missing Database Indexes

Add indexes on:

userId

status

createdAt

stripePaymentId

refundRequested

orderId

productId

Run:

npx prisma migrate dev --name add-order-indexes

P-2. Duplicate Include Objects

Extract common include object into a reusable constant.

P-3. Five COUNT Queries

Replace multiple queries with a single aggregation query.

P-4. Membership Plan Queried Twice

Fetch duration and price in one query.

P-5. Dashboard Over-fetches Data

Only fetch fields required by the dashboard.

P-6. No Caching

Use unstable_cache() with a 30-second revalidation.

P-7. Redundant Category Query

Include categoryId in the initial query to eliminate an extra databasecall.

📈 Scalability Checklist

Area                Recommendation

Order indexes       Add proper indexesOrderItem indexes   Add orderId, productIdCustomer orders     PaginationOrder statistics    Single query + cachingCoupon usage        Atomic updatesStock updates       Transactional updatesNotifications       Background queue

✅ Quick Wins

Add database indexes.

Protect Admin Order Detail page.

Verify Shippit webhook signatures.

Add order status state machine.

Escape HTML in emails.

Fix stock decrement.

📋 Executive Summary

ID    Category      Severity

S-1   Security      🔴 CriticalS-2   Security      🔴 CriticalS-3   Security      🟠 HighS-4   Security      🟠 HighS-5   Security      🟡 MediumS-6   Security      🟡 MediumS-7   Security      🟡 LowB-1   Bug           🟠 HighB-2   Bug           🟠 HighB-3   Bug           🟠 HighB-4   Bug           🟠 HighB-5   Bug           🟡 LowP-1   Performance   🔴 CriticalP-2   Performance   🟡 MediumP-3   Performance   🟡 MediumP-4   Performance   🟢 LowP-5   Performance   🟡 MediumP-6   Performance   🟡 MediumP-7   Performance   🟢 Low