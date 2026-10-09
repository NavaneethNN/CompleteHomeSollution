# Order Flow Audit Fix Implementation Plan

**Project:** CompleteHomeSollution  
**Date:** 2026-09-08  
**Base:** 92 passing tests  
**Goal:** Fix all outstanding audit findings (SEC-6 through CODE-10)

---

## Summary

This plan addresses 20 outstanding findings from ORDER_FLOW_AUDIT.md. The audit header notes that SEC-1 through SEC-5, REL-1 through REL-6, and SEC-9 were already fixed. This plan covers:

- **3 Critical Security issues** (SEC-6, SEC-7, SEC-8)
- **4 High Reliability issues** (REL-7, REL-8, REL-9, REL-10)
- **6 Medium Performance issues** (PERF-1 through PERF-6)
- **10 Low Code Quality issues** (CODE-1 through CODE-10)

**Note:** The schema shows the refund field is `paywayRefundId` (not `refundStripeId`), confirming SEC-7 and CODE-5.

---

## Execution Order

Changes are grouped by file to minimize context switching. Dependencies are resolved first (PERF-5 shared utility before files that use it).

1. Create shared coupon utility (PERF-5) — **prerequisite for step 2**
2. Fix coupon validation route (SEC-6, CODE-2 if still present)
3. Fix shipping rate API (SEC-8)
4. Fix checkout session route (REL-7, REL-8, CODE-1, CODE-10)
5. Fix cancel route (REL-7, SEC-7)
6. Fix order actions (SEC-7, CODE-5)
7. Fix order confirmation page (REL-10, CODE-3)
8. Fix cart store (REL-9)
9. Fix checkout form (PERF-3, PERF-4, PERF-6, CODE-6, CODE-9)
10. Fix admin orders page (PERF-1, PERF-2)
11. Fix admin status dropdown (CODE-4)
12. Add CSRF documentation (CODE-7)
13. Add PayWay retry limit (CODE-8)

---

## Implementation Steps

### ✅ Step 0: Verify already-fixed findings

**What:** Confirm that SEC-6/CODE-2 console.log statements were removed as claimed in audit header.

**Files to check:**
- `app/api/coupons/validate/route.ts`

**Action:** The file still has generic error handling but no `console.log` of sensitive coupon data and no raw error leak to client. The catch block returns `{ error: "Failed to validate coupon. Please try again." }` — **audit finding SEC-6 regarding raw error details in this specific file is already addressed**. However, the error handler does `console.error("[GET /api/coupons/validate]", error)` — this logs to server-side only and is acceptable. Mark SEC-6 as partially addressed (generic client message is correct, but confirm production doesn't expose stack traces).

**Outcome:** SEC-6 client-facing leak is already fixed. CODE-2 console.log statements are already removed.

---

### Step 1: Create shared coupon discount utility (PERF-5)

**What:** Extract the coupon discount calculation logic that is duplicated across 3 files into a shared utility function `calculateCouponDiscount(coupon, items, subtotal)`.

**Files to create:**
- `lib/coupon-utils.ts` (new file)

**Implementation:**
```typescript
// lib/coupon-utils.ts
import type { Coupon } from "@prisma/client";

interface CouponInput {
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maxDiscount: number | null;
}

/**
 * Calculate coupon discount amount given an applicable subtotal.
 * @param coupon - Coupon with discountType, discountValue, maxDiscount
 * @param applicableSubtotal - Subtotal of items eligible for this coupon
 * @returns Discount amount (non-negative, capped by maxDiscount if set)
 */
export function calculateCouponDiscount(
  coupon: CouponInput,
  applicableSubtotal: number
): number {
  if (applicableSubtotal <= 0) return 0;
  
  let discount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discount = (applicableSubtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount !== null && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else if (coupon.discountType === "FIXED") {
    discount = Math.min(coupon.discountValue, applicableSubtotal);
  }
  
  return Math.max(0, Math.round(discount * 100) / 100);
}
```

**Verify:** `npm run type-check` — no TypeScript errors.

---

### Step 2: Fix coupon validation route (SEC-6 final check, remove any remaining console.log)

**What:** 
- Confirm production error handling is safe (SEC-6)
- Remove any remaining debug console.log if present (CODE-2)

**Files to modify:**
- `app/api/coupons/validate/route.ts`

**Changes:**
- The current catch block already returns a generic error message to the client: `{ error: "Failed to validate coupon. Please try again." }`
- The `console.error` for server-side logging is acceptable
- **No changes needed** — SEC-6 and CODE-2 are already resolved

**Verify:** Review the error handling in the catch block — confirm it does not expose internal error details to client.

---

### Step 3: Fix shipping rate API (SEC-8)

**What:** Add authentication (session check) and rate limiting to the AusPost shipping rate endpoint.

**Files to modify:**
- `app/api/shipping/auspost/route.ts`

**Changes:**
```typescript
import { auth } from "@/auth";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // SEC-8: Require authentication to prevent abuse
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    
    // SEC-8: Rate limit shipping queries (max 20 per 5 minutes per user)
    const limit = await consumeRateLimit(
      "shipping-quotes",
      session.user.id,
      20,
      5 * 60
    );
    if (!limit.allowed) return rateLimitResponse(limit);
    
    // ... rest of existing logic
```

**Rationale:** Shipping quotes are part of checkout flow — only authenticated users should access them. Rate limiting prevents abuse of the AusPost API.

**Verify:** 
- `npm run type-check` — no errors
- `npm run test:checkout` — all tests pass

---

### Step 4: Fix checkout session route (REL-7, REL-8, CODE-1, CODE-10)

**What:**
- **REL-7**: Fetch membership price from DB instead of hardcoding $30
- **REL-8**: Apply GST to shipping cost (currently only applied to subtotal)
- **CODE-1**: Remove `any` type casts on Prisma client calls
- **CODE-10**: Populate `variantSummary` field when creating order items

**Files to modify:**
- `app/api/checkout/session/route.ts`

**Changes:**

1. **REL-7 — Fetch membership price:**
```typescript
// Around line 175-180, replace hardcoded 30 with DB fetch (already done):
const membershipCharge = wantsMembership && !alreadyMember ? defaultPlan!.price : 0;
// ✓ This is already correct — defaultPlan.price is fetched from DB
// Verify the variable is used consistently throughout (check both create and refund paths)
```

2. **REL-8 — Apply GST to shipping:**
```typescript
// Around line 350-360, fix GST calculation:
// OLD:
const tax = Math.round(subtotal * 0.1 * 100) / 100;

// NEW:
const tax = Math.round((subtotal + shippingCost) * 0.1 * 100) / 100;
```

3. **CODE-1 — Remove `any` casts:**
```typescript
// Search for "(db as any)" and "async (tx: any)" and replace with properly typed versions:
// Prisma client is fully typed — no casts needed
// Example fix:
const coupon = await db.coupon.findUnique(...) // no cast needed
await db.$transaction(async (tx) => { ... }) // tx is already typed
```

4. **CODE-10 — Populate variantSummary:**
```typescript
// In the order.create items block, add variantSummary:
items: {
  create: input.items.map((item, index) => {
    const product = products.find(p => p.id === item.productId)!;
    const variant = item.variantId 
      ? product.productVariants.find(v => v.id === item.variantId) 
      : null;
    
    // Build variant summary string if variant exists
    let variantSummary: string | null = null;
    if (variant) {
      // Fetch variant values from the variant's relations
      // Note: Need to include values in the product query include
      // variantSummary format: "Color: Red, Size: Large"
      variantSummary = "Variant"; // Placeholder - needs proper variant value fetching
    }
    
    return {
      productId: item.productId,
      productVariantId: item.variantId || null,
      quantity: item.quantity,
      unitPrice: pricing.lines[index].netCents / item.quantity / 100,
      variantSummary,
    };
  }),
},
```

**Note for CODE-10:** The proper implementation requires including `productVariants.values` in the products fetch query earlier in the route. The variant summary should be built from the variant's `values` relation which links to `variantValue` and `variantAttribute`. Format: `"Color: Red, Size: Large"`.

**Verify:**
- `npm run type-check` — no TypeScript errors
- `npm run test:checkout` — all 92 tests pass
- Manual test: Create an order and verify GST includes shipping in calculation

---

### Step 5: Fix cancel route (REL-7, SEC-7)

**What:**
- **REL-7**: Use DB-fetched membership price instead of hardcoded $30
- **SEC-7**: The field is `paywayRefundId` not `refundStripeId` — audit confirmed mismatch

**Files to modify:**
- `app/api/orders/[id]/cancel/route.ts`

**Changes:**

1. **REL-7 — Remove hardcoded membership amount:**
```typescript
// The cancel route doesn't create new membership charges, but it may need to 
// reference the original membership amount from order.membershipAmount
// Check if any hardcoded 30 exists in refund calculation — currently uses order.total
// ✓ Already correct — uses order.total and order.membershipAmount from DB
```

2. **SEC-7 — Fix field name:**
```typescript
// Line ~95, in the order.update call:
// OLD:
refundStripeId,  // Wrong field name

// NEW:
paywayRefundId,  // Correct field name from schema
```

**Verify:**
- `npm run type-check` — no errors
- Search codebase for any remaining "refundStripeId" references

---

### Step 6: Fix order actions (SEC-7, CODE-5)

**What:**
- **SEC-7/CODE-5**: Fix `refundStripeId` type to `paywayRefundId`

**Files to modify:**
- `lib/actions/orders.ts`

**Changes:**
```typescript
// In OrderWithItems interface, line ~27:
// OLD:
refundStripeId: string | null;

// NEW:
paywayRefundId: string | null;
```

**Verify:**
- `npm run type-check` — no errors
- Search for any code that references this field and update accordingly

---

### Step 7: Fix order confirmation page (REL-10, CODE-3)

**What:**
- **REL-10**: Fix membership activation detection (currently checks non-existent `addMembership` field)
- **CODE-3**: Remove unnecessary type casts for `discount` and `couponCode` (they exist in schema)

**Files to modify:**
- `app/(shop)/order-confirmation/[orderId]/page.tsx`

**Changes:**

1. **REL-10 — Fix membership detection:**
```typescript
// Line ~105, replace:
// OLD:
const membershipActivated =
  order.status === "PAID" &&
  (order as Record<string, unknown>).addMembership === true;

// NEW:
const membershipActivated = paid && order.membershipAmount > 0;
// (paid is already defined above as the status check)
```

2. **CODE-3 — Remove type casts:**
```typescript
// Lines showing (order as Record<string, unknown>).discount and .couponCode
// OLD:
(order as Record<string, unknown>).discount
(order as Record<string, unknown>).couponCode

// NEW:
order.discount
order.couponCode

// These fields exist on the Order type from Prisma
```

**Verify:**
- `npm run type-check` — no TypeScript errors
- Manual test: Place order with membership addon and verify confirmation shows it

---

### Step 8: Fix cart store (REL-9)

**What:** Add UX warning that cart uses localStorage data and stock may have changed.

**Files to modify:**
- `store/cart.ts` (add comment only — no breaking changes)
- `components/checkout/checkout-form.tsx` (add warning banner if needed)

**Changes:**

1. Add developer note in `store/cart.ts`:
```typescript
// At the top of addItem function, add comment:
/**
 * REL-9: Stock values are from localStorage and may be stale.
 * The checkout API performs authoritative stock checks before payment.
 * Cart caps quantity at the cached stock value to prevent obvious overages.
 */
```

2. In checkout form, the existing code already fetches fresh prices and shows unavailability. Add explicit note:
```typescript
// In checkout-form.tsx, around the cart display area, add a note:
{pricesReady && !unavailable && (
  <p className="text-xs text-muted-foreground">
    Stock levels are refreshed at checkout. Items may become unavailable before payment.
  </p>
)}
```

**Verify:**
- `npm run type-check` — no errors
- Existing checkout API already handles stock mismatches with clear error messages

---

### Step 9: Fix checkout form (PERF-3, PERF-4, PERF-6, CODE-6, CODE-9)

**What:**
- **PERF-3**: Skip coupon re-validation on membership toggle if coupon eligibility is "ALL"
- **PERF-4**: Only re-fetch shipping rates when postcode changes (not name/phone)
- **PERF-6**: Optimize cart subscription with selectors (or note as non-breaking)
- **CODE-6**: Convert coupon validation to POST (currently GET with JSON in query param)
- **CODE-9**: Remove duplicate guest email in address state

**Files to modify:**
- `components/checkout/checkout-form.tsx`
- `app/api/coupons/validate/route.ts` (add POST handler)

**Changes:**

1. **PERF-3 — Skip unnecessary coupon validation:**
```typescript
// In the useEffect that watches effectiveMember (around line 310):
useEffect(() => {
  if (appliedCoupon && appliedCouponCode) {
    // PERF-3: Only re-validate if coupon is membership-dependent
    if (appliedCoupon.memberEligibility === "MEMBERS_ONLY" || 
        appliedCoupon.memberEligibility === "NON_MEMBERS") {
      applyCoupon(); // Re-validate
    }
    // For "ALL" coupons, membership status doesn't affect eligibility
  }
}, [effectiveMember]);
```

**Note:** The current code doesn't track `memberEligibility` in the applied coupon state. Need to add it to the appliedCoupon object returned from validation.

2. **PERF-4 — Track last postcode:**
```typescript
// Add ref to track last fetched postcode:
const lastFetchedPostcodeRef = useRef<string | null>(null);

// Modify fetchAusPostRates:
const fetchAusPostRates = useCallback(
  async (postcode: string) => {
    if (!/^\d{4}$/.test(postcode) || !pricesReady || freeShipping) return;
    
    // PERF-4: Skip if postcode hasn't changed
    if (lastFetchedPostcodeRef.current === postcode) return;
    lastFetchedPostcodeRef.current = postcode;
    
    // ... rest of existing logic
  },
  [items, pricesReady, freeShipping]
);
```

3. **PERF-6 — Cart subscription optimization:**
```typescript
// Current: const items = useCartStore((state) => state.items);
// Optimized (if using zustand shallow):
import { useShallow } from 'zustand/react/shallow';

const items = useCartStore(
  useShallow((state) => state.items)
);

// OR derive only what's needed:
const { itemCount, subtotal } = useCartStore((state) => ({
  itemCount: state.getTotalItems(),
  subtotal: state.getSubtotal(effectiveMember),
}));
```

**Note:** PERF-6 is low priority — only optimize if performance issues are observed. The current implementation is acceptable.

4. **CODE-6 — Convert to POST:**
```typescript
// In checkout-form.tsx applyCoupon function (around line 400):
// OLD:
const params = new URLSearchParams();
params.set("code", code);
params.set("items", JSON.stringify(itemsForValidation));
params.set("addMembership", String(addMembership));
const res = await fetch(`/api/coupons/validate?${params.toString()}`);

// NEW:
const res = await fetch("/api/coupons/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    code,
    items: itemsForValidation,
    addMembership,
  }),
});
```

And add POST handler in `app/api/coupons/validate/route.ts`:
```typescript
// Add at the end of the file:
export async function POST(req: NextRequest) {
  // Same logic as GET but read from body instead of query params
  const body = await req.json();
  const { code, items, addMembership } = body;
  // ... rest of validation logic (reuse GET logic)
}
```

5. **CODE-9 — Remove duplicate email:**
```typescript
// In checkout-form.tsx, around line 450:
// The guestAddress state has an email field that duplicates guestEmail
// When setting guest address, remove email from the address object:

// OLD:
setGuestAddress({ ...data, email: guestEmail.trim().toLowerCase() });

// NEW:
setGuestAddress(data); // email is tracked separately in guestEmail state
```

**Verify:**
- `npm run type-check` — no errors
- `npm run test:checkout` — all tests pass
- Manual test: Apply coupon, toggle membership, verify API calls

---

### Step 10: Fix admin orders page (PERF-1, PERF-2)

**What:**
- **PERF-1**: Remove per-row items subquery (already using `_count` and `take: 1`)
- **PERF-2**: Cache order stats with `unstable_cache`

**Files to modify:**
- `app/(admin)/admin/orders/page.tsx`

**Changes:**

1. **PERF-1 — Already optimized:**
```typescript
// Current query already uses _count and only fetches first item:
items: {
  take: 1,
  select: { product: { select: { name: true } } },
},

// This is acceptable. Further optimization would require denormalization.
// ✓ No change needed
```

2. **PERF-2 — Cache stats:**
```typescript
import { unstable_cache } from "next/cache";

// Wrap getOrderStats with cache:
const getOrderStats = unstable_cache(
  async () => {
    // ... existing stats query
    return {
      totalOrders,
      pendingOrders,
      paidOrders,
      processingOrders,
      todayOrders: todayStats._count._all,
      todayRevenue: todayStats._sum.total ?? 0,
    };
  },
  ["admin-order-stats"],
  {
    revalidate: 60, // Cache for 60 seconds
    tags: ["admin-orders"],
  }
);
```

**Verify:**
- `npm run type-check` — no errors
- `npm run build` — build succeeds
- Manual test: Admin orders page loads quickly on repeat visits

---

### Step 11: Fix admin status dropdown (CODE-4)

**What:** Filter status dropdown to only show valid transitions from current status.

**Files to modify:**
- `components/admin/order-status-update.tsx`

**Changes:**
```typescript
// Around line 110, in the SelectContent:
// Already correctly filtered! Line 110-113:
{Object.entries(ORDER_STATUS_CONFIG).filter(([status]) =>
  status === currentStatus ||
  (ADMIN_FULFILMENT_STATUSES as readonly string[]).includes(status) && 
  ORDER_TRANSITIONS[currentStatus]?.includes(status)
).map(...)}

// ✓ This is already correct — no change needed
// CODE-4 is already implemented
```

**Verify:** Review the existing filter logic — it's already correct.

---

### Step 12: Add CSRF documentation (CODE-7)

**What:** Document that NextAuth uses SameSite=Lax cookies for CSRF protection.

**Files to create:**
- `docs/SECURITY.md` (or add to existing security doc)

**Content:**
```markdown
# Security Documentation

## CSRF Protection

CompleteHomeSollution uses NextAuth for authentication, which sets cookies with 
`SameSite=Lax` by default. This provides protection against CSRF attacks on 
state-changing endpoints (POST, PUT, DELETE).

### How it works

- All authenticated requests require a valid session cookie
- Session cookies are marked `SameSite=Lax`
- Cross-site POST requests from attacker domains are blocked by the browser
- Same-site requests (legitimate user actions) work normally

### Verification

Check `auth.ts` configuration:
- NextAuth default cookie settings include `sameSite: "lax"`
- No explicit CSRF tokens are needed for POST endpoints
- API routes that modify data require authentication via `auth()`

### Exceptions

GET endpoints that perform state changes (none in this app) would be vulnerable. 
All state-changing operations use POST/PUT/DELETE methods.
```

**Verify:** Documentation is added and reviewed.

---

### Step 13: Add PayWay retry limit (CODE-8)

**What:** Add maximum retry counter for PayWay token acquisition failures.

**Files to modify:**
- `components/checkout/payway-card-frame.tsx`

**Changes:**
```typescript
// Add state for retry counter:
const [tokenAttempts, setTokenAttempts] = useState(0);
const MAX_TOKEN_ATTEMPTS = 3;

// In the token error handler:
const handleTokenError = (error: string) => {
  setTokenAttempts(prev => prev + 1);
  
  if (tokenAttempts >= MAX_TOKEN_ATTEMPTS - 1) {
    setPaymentError(
      "Unable to process payment details after multiple attempts. " +
      "Please refresh the page and try again, or contact support."
    );
    // Optionally disable the frame or show a refresh button
  } else {
    setPaymentError(error);
  }
};

// Reset counter on successful token:
const handleTokenReceived = (token: string) => {
  setTokenAttempts(0);
  setSingleUseTokenId(token);
  setPaymentError(null);
};
```

**Verify:**
- `npm run type-check` — no errors
- Manual test: Trigger token error and verify retry limit

---

## Final Verification Steps

After all changes are complete:

1. **Type check:**
   ```bash
   npm run type-check
   ```
   Expected: No TypeScript errors

2. **Run all tests:**
   ```bash
   npm run test:checkout
   ```
   Expected: All 92 tests pass (may be more if new tests added)

3. **Build check:**
   ```bash
   npm run build
   ```
   Expected: Production build succeeds with no errors

4. **Manual checkout flow test:**
   - Add items to cart
   - Apply coupon
   - Toggle membership
   - Complete checkout with address
   - Verify order confirmation shows membership addon
   - Verify GST includes shipping cost
   - Verify admin can refund without field name errors

5. **Admin panel check:**
   - Load admin orders page
   - Verify stats load quickly (cached)
   - Update order status using dropdown
   - Verify only valid transitions shown

---

## Findings That Cannot Be Fixed Without External Access

None. All findings can be fixed in the local codebase.

---

## Already Fixed Findings (Per Audit Header)

The following were noted as fixed in the audit header:

- **SEC-1**: Coupon userId validation ✅
- **SEC-2**: Admin middleware role check ✅
- **SEC-3**: Coupon usage timing (post-payment) ✅
- **SEC-4**: Server-side shipping verification ✅
- **SEC-5**: Guest order token protection ✅
- **SEC-9**: Admin refund order (PayWay first) ✅
- **REL-1**: Stock locking with atomic decrement ✅
- **REL-2**: PayWay token race condition ✅
- **REL-3**: Cart clearing timing ✅
- **REL-4**: Pending payment polling ✅
- **REL-5**: Idempotency protection ✅
- **REL-6**: Legacy POST /api/orders protection ✅

---

## Summary of Changes by Priority

### Critical (must fix):
- SEC-6: ✅ Already fixed (generic error messages)
- SEC-7: Field name `paywayRefundId` (3 files)
- SEC-8: Shipping API auth + rate limit (1 file)

### High (affects correctness):
- REL-7: ✅ Already using DB membership price
- REL-8: GST on shipping (1 file)
- REL-9: Cart stock warning (2 files, non-breaking)
- REL-10: Membership confirmation display (1 file)

### Medium (performance):
- PERF-1: ✅ Already optimized
- PERF-2: Cache stats (1 file)
- PERF-3: Skip redundant coupon calls (1 file)
- PERF-4: Track postcode changes (1 file)
- PERF-5: Shared coupon utility (1 new file + 3 consumers)
- PERF-6: Cart selectors (optional optimization)

### Low (code quality):
- CODE-1: Remove `any` casts (1 file)
- CODE-2: ✅ Already removed console.log
- CODE-3: Remove type casts (1 file)
- CODE-4: ✅ Already filtering status dropdown
- CODE-5: Field name `paywayRefundId` (1 file)
- CODE-6: Coupon validation POST (2 files)
- CODE-7: CSRF documentation (1 new doc)
- CODE-8: PayWay retry limit (1 file)
- CODE-9: Remove duplicate email (1 file)
- CODE-10: Populate variantSummary (1 file)

**Total files to modify:** ~13 files  
**Total new files:** 2 (coupon utility + security doc)

---

## Notes for Implementation

1. **Test coverage:** The existing 92 tests cover checkout, cart, orders, and payments. They should all continue to pass. No test changes are expected unless new edge cases are discovered.

2. **Backwards compatibility:** All changes maintain existing API contracts and database schema (except field name corrections which fix existing bugs).

3. **Deployment order:** These changes can be deployed atomically in a single release. No database migrations are required (schema already has the correct field names).

4. **Rollback safety:** All changes are non-breaking and can be rolled back independently if issues arise.

---

**Plan complete.** Ready for implementation.
