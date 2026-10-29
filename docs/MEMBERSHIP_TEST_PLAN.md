# 🏆 CHS Membership — Complete Manual Test Plan

> **Goal:** Verify the membership feature end-to-end before production.  
> **Estimated time:** ~50–60 minutes  
> **Test users needed:** 1 Admin account · 1 non-member customer account · optionally 1 fresh guest account

---

## ⚙️ Pre-Test Setup Checklist

Before running any test, confirm the following:

- [ ] App is running locally (`npm run dev`) or on staging
- [ ] At least **one active membership plan** exists in Admin → Membership
- [ ] The plan is marked **Default = true**
- [ ] At least **2–3 products** are active and have **member prices** set
- [ ] Payment gateway is configured (OnlinePay or PayWay) and in **sandbox/test mode**
- [ ] You have a **test payment card** ready (use your gateway's sandbox card)
- [ ] You are logged in as **admin** in one browser tab and as a **non-member customer** in another (incognito or different browser)

---

## 📋 TEST GROUPS

| # | Group | Tests | Est. Time |
|---|-------|-------|-----------|
| A | Admin — Plan Management | A1–A5 | 8 min |
| B | Membership Page (Customer) | B1–B4 | 5 min |
| C | Standalone Membership Purchase | C1–C4 | 10 min |
| D | Add-On Membership at Checkout | D1–D5 | 10 min |
| E | Member Pricing in Shop | E1–E4 | 7 min |
| F | Post-Payment Activation | F1–F3 | 5 min |
| G | Admin — Grant & Revoke | G1–G3 | 5 min |
| H | Renewal & Expiry Logic | H1–H3 | 5 min |
| I | Edge Cases & Guards | I1–I5 | 5 min |

---

## A — Admin: Plan Management

### A1 · Create a Membership Plan

**Path:** Admin → Membership → Create Plan

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open `/admin/membership` | Page loads. Stats show current plans/members/revenue |
| 2 | Click **Create Plan** | Modal/form opens |
| 3 | Fill: Name = "CHS Premium", Price = 30, Duration = 365 days, Discount = 30%, Active = ON, Default = ON | Fields accept input |
| 4 | Submit | Success toast. Plan appears in the list with correct values |
| 5 | Check the "Plans" stat card | Count increases by 1 |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### A2 · Edit a Plan

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Edit** on the plan | Form pre-fills with saved values |
| 2 | Change price from 30 → 35, click Save | Success. Plan shows updated price |
| 3 | Change price back to 30, Save | Restored correctly |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### A3 · Set Default Plan

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create a second plan (e.g., "CHS Basic", price = 20, 180 days, NOT default) | Plan created |
| 2 | Click **Set as Default** on the Basic plan | Basic becomes default, Premium loses default badge |
| 3 | Set Premium back as default | Premium is default again |
| 4 | Delete the Basic plan | Plan removed from list. No error |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### A4 · Deactivate a Plan

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Edit the plan and set **Active = OFF**, Save | Plan shows as inactive |
| 2 | Open `/membership/checkout` as a customer | Shows "Membership is currently unavailable" |
| 3 | Go back to admin, re-activate the plan | Active again |
| 4 | Reload `/membership/checkout` as customer | Plan and price shown correctly |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### A5 · Revenue Counter

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Note the current "Est. Revenue" value on the admin membership page | Value noted |
| 2 | Complete a membership purchase (do Test C3 first) | — |
| 3 | Reload admin membership page | Revenue increased by the plan price |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

## B — Customer: Membership Landing Page

### B1 · Non-Member View

**Path:** `/account/membership` (logged in, NOT a member)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open the page | Shows "Unlock CHS Premium" banner with navy background |
| 2 | Check perks list | 4 perks visible: discount %, free delivery, warranty, early access |
| 3 | Check CTA button | Shows "Become a Member — $30/year" (or your plan price) |
| 4 | Check plan price in CTA | Matches the active plan's price exactly |
| 5 | Sidebar shows user initials | No "MEMBER" badge visible |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### B2 · Non-Logged-In Redirect

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Log out. Visit `/account/membership` | Redirected to `/login` |
| 2 | Log in | Redirected back to membership page |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### B3 · Active Member View

*(Complete after Test C or G to have an active member account)*

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open `/account/membership` as active member | Shows dark "CHS Premium Member" gradient banner with **ACTIVE** green badge |
| 2 | Check "Member since" card | Shows correct join date |
| 3 | Check expiry text | Shows expiry date (Sydney time) |
| 4 | Check perks grid | All 4 perks shown with checkmark icons |
| 5 | Sidebar | Shows gold **MEMBER** badge next to user initials |
| 6 | Check CTAs | "Shop with Member Prices" and "View My Orders" buttons present |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### B4 · Expired Membership View

*(Set `membershipExpiry` to a past date in DB to simulate — or complete Test H2 first)*

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open `/account/membership` with expired account | Shows "Your CHS Premium membership has expired" with expiry date |
| 2 | CTA button | Shows **"Renew Membership"** (not "Become a Member") |
| 3 | Sidebar | No MEMBER badge |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

## C — Standalone Membership Purchase

### C1 · Navigate to Membership Checkout

**Path:** `/membership/checkout` or via button on `/account/membership`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Become a Member" CTA | Navigates to `/membership/checkout?planId=...` |
| 2 | Page loads | Shows plan name, price, and duration. Form with billing fields |
| 3 | Confirm correct plan | Price and duration match the active/default plan |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### C2 · Form Validation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit form with all fields empty | Validation prevents submission |
| 2 | Enter invalid postcode (e.g., "99") | Error or rejected |
| 3 | Enter postcode with letters (e.g., "ABCD") | Rejected |
| 4 | Leave name blank | Required validation fires |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### C3 · Successful Payment Flow

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Fill form with valid billing details | All fields accepted |
| 2 | Click **Continue to secure payment** | Button shows "Opening secure payment…" then redirects to gateway |
| 3 | Complete payment using **sandbox test card** | Redirected back to `/order-confirmation/[orderId]` |
| 4 | Order confirmation page | Shows membership order, correct amount |
| 5 | Check banner on confirmation page | "Welcome to CHS Premium!" activation banner visible |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### C4 · Duplicate Purchase Guard

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | As an **active member**, visit `/membership/checkout` | — |
| 2 | Try to submit the checkout form | API returns **409 "You already have an active membership"** error message |
| 3 | Confirm no duplicate order created | Check admin orders — only one membership order exists |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

## D — Add-On Membership at Checkout

### D1 · Membership Add-On Visible at Checkout

**Path:** `/checkout` (logged in as non-member, with items in cart)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add a product with a member price to cart | Product in cart |
| 2 | Go to `/checkout` | Order Summary shows membership add-on card |
| 3 | Card shows "Add CHS Membership" with `+$30` badge | Correct price from active plan |
| 4 | Card is **unchecked** by default | Checkbox is empty |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### D2 · Toggling the Add-On Updates Totals

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Check the membership add-on checkbox | Checkbox fills, "Membership added — activates after payment" strip appears |
| 2 | Order Summary total | Increases by the plan price ($30) |
| 3 | Subtotal line items | Member pricing applied to eligible products |
| 4 | "Member savings" row | Shows how much you save with member prices |
| 5 | Uncheck the membership add-on | Total reverts, non-member prices restored |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### D3 · Perks Expandable Section

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click the chevron icon on the membership add-on card | Perks list expands |
| 2 | Perks show: discount %, free delivery, warranty, early access | All 4 visible |
| 3 | Click chevron again | Collapses |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### D4 · Add-On Not Shown for Existing Members

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Log in as an **active member** | — |
| 2 | Add items to cart and go to checkout | Membership add-on card is **NOT visible** |
| 3 | Member prices already applied | Subtotal reflects member pricing automatically |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### D5 · Full Purchase with Add-On Checked

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Check membership add-on, complete all checkout fields | Order total includes plan price |
| 2 | Place order via test payment | Redirected to confirmation page |
| 3 | Order confirmation | Shows product(s) + membership line item |
| 4 | Navigate to `/account/membership` | Shows **ACTIVE** member view |
| 5 | Browse products | Member prices applied immediately |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

## E — Member Pricing in the Shop

### E1 · Product Listing Page

**Path:** `/products` (logged in as active member)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Browse products listing | Products with member prices show the lower price |
| 2 | Product with member price set | Shows member price, original price struck through |
| 3 | "Member price applied" badge | Visible under the price |
| 4 | Log out and revisit | Full prices shown, no member badge |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### E2 · Product Detail Page

**Path:** `/products/[slug]` (logged in as active member)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open a product with a member price | Member price shown prominently |
| 2 | "Member price" label present | Confirms member pricing is active |
| 3 | Add to cart | Cart reflects member price |
| 4 | Non-member visits same page | Full price shown, no member label |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### E3 · Cart Page Pricing

**Path:** `/cart` (logged in as active member)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add a product with member price to cart | — |
| 2 | Open cart | Member price applied to line item |
| 3 | Cart subtotal | Reflects member prices, not full prices |
| 4 | "Member savings" summary line | Shows how much saved vs full price |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### E4 · Free Shipping for Members

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | As a member, go to checkout with any cart total (even under $1,200) | — |
| 2 | Order Summary shipping row | Shows **"Free"** in green |
| 3 | No shipping rate selection needed | Shipping options panel hidden |
| 4 | As non-member with cart < $1,200 | Normal shipping rates shown |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

## F — Post-Payment Activation

### F1 · Session Refresh After Purchase

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Purchase membership (Test C3 or D5) | — |
| 2 | Land on order confirmation page | "Welcome to CHS Premium!" banner appears |
| 3 | Navigate to `/products` without logging out | Member prices applied — no logout/login cycle required |
| 4 | Navigate to `/account/membership` | Shows active member view |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### F2 · Membership Reflected in Account Dashboard

**Path:** `/account/dashboard`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open dashboard after membership activation | Membership status / badge visible |
| 2 | Membership expiry date shown | Correct date (today + plan duration) |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### F3 · Membership Order in Order History

**Path:** `/account/orders`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open orders list | Membership order appears in the list |
| 2 | Click the membership order | Order detail shows membership line item, amount, and status |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

## G — Admin: Grant & Revoke Membership

### G1 · Admin Grant Membership

**Path:** Admin → Membership → Members tab

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Find a non-member customer (check Customers list) | — |
| 2 | Click **Grant Membership** for that user | Success toast |
| 3 | User appears in the Members list | Shows name and expiry date |
| 4 | Log in as that user, open `/account/membership` | Shows active member view with correct expiry |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### G2 · Admin Revoke Membership

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Find an active member in admin members list | — |
| 2 | Click **Revoke** and confirm | Success toast |
| 3 | User disappears from the members list | Confirmed |
| 4 | Log in as that user, open `/account/membership` | Shows non-member upgrade view |
| 5 | Check member prices on products | Full prices shown — no member pricing |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### G3 · Admin Revenue & Stats Accuracy

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Note current: Plans count, Active Members count, Revenue | Values noted |
| 2 | Grant a membership (G1) | Active Members +1 |
| 3 | Revoke it (G2) | Active Members returns to original |
| 4 | Revenue stat | Only changes for **paid** memberships, not admin grants |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

## H — Renewal & Expiry Logic

### H1 · Renewal Extends from Existing Expiry (Stacking)

> Verifies that renewing while still active stacks time from current expiry — not from today.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Note the active member's current expiry date (e.g., 2027-10-18) | Date noted |
| 2 | Purchase membership again as that member | Goes through payment flow |
| 3 | Check new expiry | New expiry = old expiry + plan duration (e.g., 2028-10-18) — NOT today + duration |
| 4 | Admin membership page | Updated expiry reflects correctly |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### H2 · Expiry Enforcement on Page Load

> Set `membershipExpiry` to a past date in DB to simulate natural expiry.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In DB: set a member's `membershipExpiry` to yesterday, keep `isMember = true` | — |
| 2 | Log in as that user, open `/account/membership` | `enforceExpiry()` fires — `isMember` becomes `false` in DB |
| 3 | Page displays | **Expired view** — "Your CHS Premium membership has expired" with the expired date |
| 4 | Browse products | Full prices shown — member pricing no longer applied |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### H3 · Expiry Date Displayed Correctly

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open `/account/membership` as active member | Expiry text: "Benefits expire on [date] (Sydney time)" |
| 2 | Date is in the future | Correct |
| 3 | Timezone label shown | "Sydney time" appears in the note |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

## I — Edge Cases & Guards

### I1 · Guest Cannot Access Membership Checkout

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Log out completely | Logged out |
| 2 | Visit `/membership/checkout` directly | Redirected to `/login?callbackUrl=/membership/checkout` |
| 3 | Log in | Returns to membership checkout page |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### I2 · No Active Plan — Graceful Degradation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Admin: deactivate ALL membership plans | — |
| 2 | Customer visits `/account/membership` | "No plans available — check back soon." — no broken layout |
| 3 | Customer visits `/membership/checkout` | "Membership is currently unavailable." message |
| 4 | Checkout page membership add-on | Card not shown |
| 5 | Re-activate plan | Everything works normally |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### I3 · Idempotency — No Double Charge

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | At checkout with membership add-on enabled, click Place Order | Button disables immediately |
| 2 | Try clicking a second time while processing | Button remains disabled — no double submission |
| 3 | After payment, check DB | Only **one** membership order and one `MembershipPayment` record |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### I4 · Coupon + Member Pricing Interaction

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | At checkout as non-member, apply a valid coupon | Discount applied to subtotal |
| 2 | Toggle membership add-on ON | Member prices apply to eligible items; coupon re-validates |
| 3 | Check total | Reflects: member prices + coupon discount + membership fee combined correctly |
| 4 | Toggle membership add-on OFF | Returns to full prices + coupon discount only |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

### I5 · Membership Add-On NOT Shown for Guests

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Log out. Add item to cart | Cart saved in localStorage |
| 2 | Go to `/checkout` as guest | Membership add-on card **not shown** |
| 3 | Checkout proceeds normally | No membership-related UI for guests |

- [ ] **PASS** / [ ] FAIL — Notes: _______________

---

## ✅ Final Sign-Off

| Group | Result | Issues Found |
|-------|--------|-------------|
| A — Admin Plan Management | ☐ Pass ☐ Fail | |
| B — Membership Page | ☐ Pass ☐ Fail | |
| C — Standalone Purchase | ☐ Pass ☐ Fail | |
| D — Add-On at Checkout | ☐ Pass ☐ Fail | |
| E — Member Pricing | ☐ Pass ☐ Fail | |
| F — Post-Payment Activation | ☐ Pass ☐ Fail | |
| G — Admin Grant & Revoke | ☐ Pass ☐ Fail | |
| H — Renewal & Expiry | ☐ Pass ☐ Fail | |
| I — Edge Cases | ☐ Pass ☐ Fail | |

**Tested by:** _______________  
**Date:** _______________  
**Gateway mode:** ☐ Sandbox  ☐ Live  
**Overall verdict:** ☐ **PRODUCTION READY** ☐ **Issues to fix before launch**

---

## 🐛 Issues Log

| Test | Description | Severity | Status |
|------|-------------|----------|--------|
| | | | |

---

## 🧪 Sandbox Payment Cards

> Never use real card numbers during testing.

| Gateway | Card Number | Expiry | CVV |
|---------|------------|--------|-----|
| Westpac PayWay | `4564710000000004` | Any future date | Any 3 digits |
| Westpac OnlinePay | Use cards from OnlinePay sandbox docs | — | — |
| Stripe (if configured) | `4242 4242 4242 4242` | Any future date | Any 3 digits |

---

*Generated: 2026-10-18 | Complete Home Sollution — Membership Feature Test Plan*

