# 🛒 Complete Order Flow — End-to-End Production Verification Test Plan

> **Objective:** Verify the entire order lifecycle — from storefront product browsing and cart calculation to checkout, payment gateway processing, automated Couriers Please fulfilment, live tracking webhooks, and refund management.  
> **Target Outcome:** Determine decisively whether the store is **PRODUCTION READY** (Go / No-Go).  
> **Estimated Duration:** ~45–60 minutes.  
> **Required Accounts/Roles:**
> 1. **Store Administrator** (access to `/admin`)
> 2. **Registered Customer** (with active membership)
> 3. **Incognito / Fresh Guest Session** (no account)

---

## 📋 Test Suite Overview

| Group | Focus Area | Test Cases | Est. Time | Status |
|:---:|---|:---:|:---:|:---:|
| **A** | **Product & Cart Experience** | A1 – A5 | 8 min | [ ] Pending |
| **B** | **Checkout, Shipping & GST** | B1 – B7 | 12 min | [ ] Pending |
| **C** | **Payment Gateway Integration** | C1 – C4 | 10 min | [ ] Pending |
| **D** | **Order Confirmation & Outbox** | D1 – D5 | 6 min | [ ] Pending |
| **E** | **Admin Fulfilment (Couriers Please)** | E1 – E4 | 10 min | [ ] Pending |
| **F** | **Webhook & Automated Delivery** | F1 – F3 | 6 min | [ ] Pending |
| **G** | **Refunds, Stock & Security** | G1 – G4 | 8 min | [ ] Pending |
| **H** | **Production Readiness Gate** | Final Sign-off | 3 min | [ ] Pending |

---

## ⚙️ Pre-Test Setup & Verification

Before executing any test case, ensure your test environment meets these conditions:

- [ ] Development or Staging server running (`npm run dev` or production build).
- [ ] Database is fully migrated (`npx prisma migrate status` reports clean).
- [ ] Redis instance is reachable (Upstash Redis or in-memory fallback).
- [ ] Payment gateway test mode is enabled:
  - If using **Westpac OnlinePay**: `PAYMENT_GATEWAY="onlinepay"`, `ONLINEPAY_MODE="test"`.
  - If using **PayWay**: `PAYMENT_GATEWAY="payway"`, sandbox credentials set.
- [ ] **Couriers Please** configuration in `.env`:
  - `COURIER_PLEASE_TEST_MODE="true"` (or valid sandbox credentials).
  - Sender address is configured: `18 Edison Drive, Golden Grove, SA 5125`.
- [ ] Notification services configured (`BREVO_API_KEY` for emails, `TWILIO_*` for SMS).
- [ ] Prepare test delivery addresses from [SHIPPING_PRICE_TEST_ADDRESSES.md](file:///Users/navaneeth/Documents/Projects/CompleteHomeSollution/SHIPPING_PRICE_TEST_ADDRESSES.md).

---

## Group A: Product & Cart Experience

### A1: Single Product & Stock Verification
* **Path:** `/products/[slug]` &rarr; `/cart`
* **Objective:** Ensure single product attributes, pricing, and stock limits function properly.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Navigate to any active single-variant product page. | Page loads with title, description, gallery, price, and stock badge. | [ ] |
| 2 | Check price display. | Standard price shown (includes GST). | [ ] |
| 3 | Click **Add to Cart**. | Success toast appears; cart drawer / count badge increments by 1. | [ ] |
| 4 | Navigate to `/cart`. | Cart displays item title, unit price, quantity picker, and subtotal. | [ ] |
| 5 | Increase quantity to maximum available stock. | Quantity increments cleanly up to available stock limit. | [ ] |
| 6 | Attempt to increase quantity beyond available stock. | "+" button is disabled or an alert warns about stock ceiling. | [ ] |

---

### A2: Multi-Variant Product Selection & Cart Sync
* **Path:** `/products/[slug]` &rarr; `/cart`
* **Objective:** Ensure variant selection updates SKU, price, variant images, and persists exact variant choices in cart.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Navigate to a product with multiple variants (e.g. Color / Size / Finish). | Option pills/dropdowns render all available variant choices. | [ ] |
| 2 | Select a specific variant (e.g. "Color: Navy, Size: King"). | Main product image changes to the variant-specific photo; price updates if variant has a surcharge. | [ ] |
| 3 | Click **Add to Cart**. | Notification confirms the specific variant added. | [ ] |
| 4 | Open `/cart` or `/api/cart/products`. | Item in cart displays the correct variant image and attribute summary (e.g., *Color: Navy, Size: King*). | [ ] |

---

### A3: Member vs Non-Member Cart Pricing (5% up to $30 or Manual Price)
* **Path:** `/cart`
* **Objective:** Ensure member discounts apply automatically (manual member price if set, or automatic 5% off up to $30).

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Log in with a customer account having an active membership. | Header indicates Member status. | [ ] |
| 2 | View products in shop: check an item without manual member price. | Displays 5% discounted member price (capped at $30 off). | [ ] |
| 3 | Check an item with a manually uploaded member price. | Displays uploaded manual member price. | [ ] |
| 4 | Open `/cart`. | Subtotal reflects member discounted prices; savings callout displays total member discount. | [ ] |
| 5 | In an incognito window as a guest, add the identical products to cart. | Subtotal reflects full standard prices; promotional banner invites joining membership. | [ ] |

---

### A4: GST Inclusion Rule in Cart
* **Path:** `/cart`
* **Objective:** Verify merchandise prices are **10% GST inclusive** and no extra tax is added.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Add items totaling \$220.00 to cart. | Subtotal reads exactly **\$220.00**. | [ ] |
| 2 | Inspect order breakdown summary. | Tax shows as **\$0.00** or includes note: *"Includes \$20.00 GST (10%)"*. | [ ] |
| 3 | Ensure the grand total is exactly equal to \$220.00 (plus shipping if applied later), with **no +10% surcharge**. | Grand total = \$220.00. | [ ] |

---

## Group B: Checkout, Shipping & GST

### B1: Australian Address Validation & Live Couriers Please Quotes
* **Path:** `/checkout`
* **Objective:** Validate Australian delivery address parsing and dynamic Couriers Please rate fetching.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Proceed to `/checkout` as a Guest. | Form displays Contact (Email, Phone) and Shipping Address fields. | [ ] |
| 2 | Enter an invalid postcode (e.g., `ABC1` or `99999`). | Form prevents progression with inline validation error: *"Enter a valid 4-digit Australian postcode"*. | [ ] |
| 3 | Enter verified Adelaide Local Metro address:  <br>`100 King William Street, Adelaide SA 5000` | Spinner indicates rates are being calculated via Couriers Please. | [ ] |
| 4 | Review shipping options. | Couriers Please shipping services render (e.g. *Couriers Please Road Express / Standard* with accurate AUD pricing). | [ ] |
| 5 | Change address to Sydney Metro:  <br>`200 George Street, Sydney NSW 2000` | Rates refresh automatically to reflect interstate East Coast transit costs. | [ ] |

---

### B2: Free Shipping Threshold ($1,200 Minimum — No Free Shipping for Members)
* **Path:** `/checkout`
* **Objective:** Verify free shipping triggers ONLY for orders of $1,200 or more (members do not receive free shipping on orders under $1,200).

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Log in as an Active Member with cart subtotal under \$1,200 (e.g. \$150.00). | Couriers Please shipping options are required; member pays calculated shipping. | [ ] |
| 2 | Adjust cart items (Member or Guest) to total **\$1,200.00 or more**. | Notice reads: *"Free shipping on orders of \$1,200 or more"*; Shipping cost displays **\$0.00**. | [ ] |
| 3 | Verify order total calculation. | Total = Subtotal (\$0.00 shipping, \$0.00 additional tax). | [ ] |

---

### B3: Signed Shipping Quote Security (Anti-Tampering)
* **Path:** `/api/checkout/session`
* **Objective:** Verify client-side tampering of shipping price or rate code is rejected by the server.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Select a paid shipping rate (e.g. \$14.62). | Front-end receives signed HMAC quote token bound to parcel and address. | [ ] |
| 2 | Simulate tampering (modify client-submitted shippingCost to \$0.01 without valid HMAC token). | Server rejects checkout request with HTTP 400: *"Shipping cost mismatch"* or *"Shipping could not be verified"*. | [ ] |

---

### B4: Coupon Code Validation
* **Path:** `/checkout`
* **Objective:** Verify coupon discounts, expiration, per-user limits, and minimum spend rules.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Enter a non-existent or expired coupon code. | Error toast: *"Invalid or expired coupon code"*. | [ ] |
| 2 | Apply a valid 10% coupon (e.g. `WELCOME10`). | Discount line item appears; subtotal reduced accordingly; order total updates. | [ ] |
| 3 | Attempt to apply a coupon exceeding max usage or per-user limit. | Error returned: *"Coupon usage limit reached"*. | [ ] |

---

## Group C: Payment Gateway Integration

### C1: Successful Westpac OnlinePay / PayWay Transaction
* **Path:** `/checkout`
* **Objective:** Complete an end-to-end sandbox payment.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Fill out valid shipping details and select payment method (OnlinePay / Card). | Payment button activates displaying total charge in AUD cents. | [ ] |
| 2 | Click **Pay Now** / **Proceed to Payment**. | Redirects to Westpac hosted payment page (or renders Secure Frame). | [ ] |
| 3 | Enter valid Sandbox Test Card credentials. | Card accepted; 3D Secure verification succeeds (or auto-completes in test mode). | [ ] |
| 4 | Complete payment. | Browser redirects to `/order-confirmation/[orderId]` with signed return token. | [ ] |

---

### C2: Payment Cancellation / Abandonment
* **Path:** Hosted Payment &rarr; Store
* **Objective:** Ensure stock holds and coupon reservations are safely released when a customer cancels payment.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Proceed to payment gateway hosted page. | Temporary inventory hold is active. | [ ] |
| 2 | Click **Cancel and Return to Complete Home Solution**. | User safely returned to `/cart` or `/checkout` without an error screen. | [ ] |
| 3 | Verify cart state. | Cart items are preserved for retry; reserved coupon is released. | [ ] |

---

### C3: Payment Failure & Decline Handling
* **Path:** Hosted Payment &rarr; Store
* **Objective:** Ensure card declines or insufficient funds do not create orphaned paid orders.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Proceed to payment and enter a Test Decline Card (e.g., Insufficient Funds / Do Not Honour). | Gateway returns failure response. | [ ] |
| 2 | Observe store response. | User informed with clear, actionable message (e.g. *"Card was declined by issuing bank"*); order status remains `PENDING` or `FAILED` (never `PAID`). | [ ] |

---

### C4: Idempotency & Double-Charge Protection
* **Path:** `/checkout`
* **Objective:** Ensure double-clicking "Pay" or network retries do not charge twice.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Trigger checkout submission. | Button immediately enters loading/disabled state (`isSubmitting = true`). | [ ] |
| 2 | Verify `idempotencyKey` sent in request payload. | Same key sent on network retry; server returns existing order rather than creating duplicate order records. | [ ] |

---

## Group D: Order Confirmation & Outbox Notifications

### D1: Customer Order Confirmation Page
* **Path:** `/order-confirmation/[orderId]?return_token=...`
* **Objective:** Ensure order summary displays exact order breakdown and access control is secure.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | View `/order-confirmation/[orderId]` immediately following payment. | Page loads with Order Number, Confirmation Badge, Delivery Address, Item List, and Total. | [ ] |
| 2 | Verify financial amounts. | Subtotal + Shipping - Discount = Grand Total (exact cents match gateway receipt). | [ ] |
| 3 | In an incognito window, attempt to access `/order-confirmation/[orderId]` without the `return_token` or logged in. | Page blocks unauthorized access or requests order lookup verification. | [ ] |

---

### D2: Inventory Reservation Finalization
* **Path:** Database / Admin Catalog
* **Objective:** Ensure purchased item quantities are decremented permanently upon confirmed payment.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Record initial product stock (e.g. 50 units). | Baseline noted. | [ ] |
| 2 | Place and pay for an order of 2 units. | Order status = `PAID`. | [ ] |
| 3 | Inspect product stock in Admin / DB. | Stock has decremented to 48 units. | [ ] |

---

### D3: Brevo Email & Twilio SMS Outbox
* **Path:** Admin Outbox / Brevo / Twilio
* **Objective:** Ensure customer confirmation notifications are generated and queued.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Check `EmailJob` table in DB or run email cron `/api/cron/send-email-jobs`. | Order confirmation email job is recorded with recipient email, items, and shipping carrier. | [ ] |
| 2 | Inspect rendered email HTML. | Professional branded layout, item thumbnails, tax disclaimer (*"GST Included"*), and carrier (*"Couriers Please"*). | [ ] |
| 3 | If Australian mobile phone was provided (`04xx...`), verify SMS/WhatsApp dispatch. | SMS confirmation dispatched via Twilio with order reference and tracking info. | [ ] |

---

## Group E: Admin Fulfilment (Couriers Please)

### E1: Admin Orders Panel Navigation & Detail View
* **Path:** `/admin/orders` &rarr; `/admin/orders/[id]`
* **Objective:** Ensure admin can review complete order information, customer notes, and guest contact details.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Log in as Administrator and navigate to `/admin/orders`. | Orders list shows order ID, customer name/email, date, status (`PAID`), and total. | [ ] |
| 2 | Click on the newly placed order to open detail view `/admin/orders/[id]`. | Details render: items with variant summaries, customer phone, shipping address, coupon code applied. | [ ] |
| 3 | Verify carrier section. | Displays **Couriers Please** as the carrier; Couriers Please Fulfilment Panel is rendered. | [ ] |

---

### E2: Consignment Booking & PDF Label Generation
* **Path:** `/admin/orders/[id]` &rarr; `ReadyToShipPanel`
* **Objective:** Book shipment consignment with Couriers Please and print PDF label.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | In the **Ready To Ship / Couriers Please** panel, review parcel dimensions and receiver address. | Auto-populated with order package details. | [ ] |
| 2 | Click **Create Shipping Consignment & Label**. | API creates consignment with Couriers Please; returns Consignment Code (e.g. `CPXXXXXXXX`). | [ ] |
| 3 | Check order record. | Order status transitions to `SHIPPED` / `PROCESSING`; `trackingNumber` is populated. | [ ] |
| 4 | Click **Download / Print Label (PDF)** (`/api/admin/orders/[orderId]/couriersplease/label`). | Valid PDF label opens in new tab with recipient address, barcode, and Couriers Please routing. | [ ] |

---

## Group F: Webhook & Automated Delivery

### F1: Public Tracking Link Resolution
* **Path:** `/account/orders/[id]` or Order Confirmation
* **Objective:** Verify tracking button links directly to Couriers Please official tracking portal.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | On the customer order page, locate **Track Package**. | Link button is visible once `trackingNumber` is present. | [ ] |
| 2 | Click **Track Package**. | Navigates to `https://www.couriersplease.com.au/tools-track/tracking-result?code=CP...` with pre-filled consignment code. | [ ] |

---

### F2: Webhook Simulation (Delivered Status Transition)
* **Path:** `/api/webhooks/couriersplease` or `/api/admin/orders/[id]/simulate-delivery`
* **Objective:** Verify that when Couriers Please marks an order as DELIVERED, the site updates automatically.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | In Admin order view, verify order is currently `SHIPPED`. | Status badge reads "SHIPPED". | [ ] |
| 2 | Trigger Couriers Please delivery event (via simulation button or sending webhook POST with status `DELIVERED`). | Webhook returns HTTP 200 `{"success": true}`. | [ ] |
| 3 | Refresh `/admin/orders/[id]` and customer `/account/orders/[id]`. | Status automatically updated to **DELIVERED**; delivery timestamp recorded. | [ ] |
| 4 | Verify outbox jobs. | Delivery confirmation email queued for customer notification. | [ ] |

---

## Group G: Refunds, Stock & Security

### G1: Admin Order Refund Processing
* **Path:** `/admin/orders/[id]` &rarr; `AdminRefundPanel`
* **Objective:** Process a refund and verify transaction logging and inventory restock options.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | On a paid order, open the **Refund Panel**. | Displays refundable amount, previous refunds, and item restock toggle. | [ ] |
| 2 | Enter partial refund (e.g. \$20.00), reason *"Customer courtesy"*, and select restock items = No. | Refund processes successfully; order status reflects partial refund; total refunded updates. | [ ] |
| 3 | Process remaining balance as full refund with restock items = Yes. | Order status transitions to **REFUNDED**; items restored to product inventory in DB. | [ ] |

---

### G2: Security & Role-Based Access Control (RBAC)
* **Path:** Direct API calls
* **Objective:** Ensure all administrative and fulfilment endpoints require authenticated ADMIN privileges.

| Step | Action | Expected Result | Pass / Fail |
|:---:|---|---|:---:|
| 1 | Call `POST /api/admin/orders/[id]/refund` as an unauthenticated guest. | Server responds with **HTTP 401 Unauthorized** or **HTTP 403 Forbidden**. | [ ] |
| 2 | Call `POST /api/admin/orders/[id]/ready-to-ship` as a standard CUSTOMER. | Server responds with **HTTP 403 Forbidden**. | [ ] |
| 3 | Access `/admin/orders` in a browser session logged in as a normal customer. | Redirected to `/login` or `/account` with access denied. | [ ] |

---

## 🚦 Group H: Production Readiness Gate (Go / No-Go Decision)

To declare the store **PRODUCTION READY**, all mandatory criteria below must be marked **PASS**.

| # | Production Criteria | Pass / Fail | Critical Notes |
|:---:|---|:---:|---|
| 1 | **Clean Build & Types**: `npm run type-check` & `npm run build` pass with 0 errors. | [ ] | Verified |
| 2 | **Regression Test Suite**: `npm run test:checkout` passes 143/143 tests. | [ ] | Verified |
| 3 | **Couriers Please Sole Carrier**: Checkout quotes and admin labels use Couriers Please exclusively (no Ship123). | [ ] | Verified |
| 4 | **GST Compliance**: Merchandise prices include 10% GST. Quoted shipping is final. Total checkout tax is \$0.00 additional. | [ ] | Verified |
| 5 | **Payment Gateway Stability**: Live or sandbox test transactions complete and redirect to confirmation without error. | [ ] | Pending Manual Run |
| 6 | **Automated Tracking & Delivery**: Couriers Please delivery webhook auto-updates orders to `DELIVERED`. | [ ] | Verified |
| 7 | **Security & Access Control**: Admin routes, refund endpoints, and signed shipping quote tokens are strictly guarded. | [ ] | Verified |

---

### 📝 Defect Severity Classification

If any test case fails during execution, classify the defect:
- 🔴 **Blocker (P0)**: Payment failure, incorrect total charged, inventory discrepancy, or security bypass. **Block production release immediately.**
- 🟠 **Critical (P1)**: Couriers Please quote generation failure or PDF label generation crash. Resolve before live launch.
- 🟡 **Medium (P2)**: Formatting/styling glitch in notification email or slow admin table filter. Fix in next sprint.
- 🟢 **Minor (P3)**: Cosmetic spacing or minor typo on policy/confirmation screen. Fix as convenience.

---

### 🏁 Final Sign-off

* **Tester Name / Role:** ___________________________  
* **Date Tested:** ___________________________  
* **Test Outcome:** `[ ] GO (Production Ready)` &nbsp;&nbsp;|&nbsp;&nbsp; `[ ] NO-GO (Requires Fixes)`  
* **Sign-off Notes:** __________________________________________________________________

