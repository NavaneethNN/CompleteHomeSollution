# Deployment Checklist - Westpac OnlinePay Integration

## 🚨 CRITICAL - Must Complete Before Going Live

### 1. Rotate Webhook Secret
**Why:** Current secret `164f8e6e...` was exposed in git history

```bash
# Generate new secret
openssl rand -hex 32

# Update in TWO places:
# 1. Application environment
ONLINEPAY_WEBHOOK_SECRET=<new_secret_here>

# 2. Westpac OnlinePay Dashboard
# Webhook URL: https://yourdomain.com/api/webhooks/onlinepay?secret=<new_secret_here>
```

**Verification:**
```bash
# Test webhook with curl
curl -X POST https://yourdomain.com/api/webhooks/onlinepay \
  -H "x-onlinepay-webhook-secret: <new_secret>" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"test","content":{}}'

# Expected: {"received":true}
```

---

### 2. Apply Database Migrations

```bash
# Production database
npx prisma migrate deploy

# Verify migrations applied
npx prisma migrate status

# Verify all checkout/membership columns through the application's connection
npm run check:checkout

# Exercise membership creation, activation, duplicate handling and revocation.
# All database writes are rolled back; no provider payment is submitted.
npm run check:membership
```

**Required migrations:**
- `20260920000100_membership_purchase_snapshot`
- `20260908070321_add_order_idempotency_key`
- All prior migrations

Apply migrations before serving the updated application. The membership snapshot
migration adds columns used by ordinary Order reads as well as membership checkout;
generating the Prisma client alone does not update the database.

---

### 3. Configure Environment Variables

**OnlinePay Credentials (LIVE mode):**
```env
# Switch to LIVE environment
ONLINEPAY_MODE=live
ONLINEPAY_USER_UID=<live_merchant_uid>
ONLINEPAY_API_KEY=<live_api_key>
ONLINEPAY_ENTITY_ID=<live_entity_id>
ONLINEPAY_PPC_ID=<live_payment_contract_id>
ONLINEPAY_3DS_ID=<live_3ds_contract_id>

# Rotated webhook secret (see step 1)
ONLINEPAY_WEBHOOK_SECRET=<new_secret_64_chars>

# Production URLs (must be HTTPS)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
ONLINEPAY_RETURN_BASE_URL=https://yourdomain.com

# Enable OnlinePay gateway
PAYMENT_GATEWAY=onlinepay
NEXT_PUBLIC_PAYMENT_GATEWAY=onlinepay
```

**Other Required Variables:**
```env
# NextAuth (keep existing or generate new)
AUTH_SECRET=<your_existing_auth_secret>
NEXTAUTH_URL=https://yourdomain.com

# Database
DATABASE_URL=<your_production_database_url>
```

---

### 4. Configure Westpac Dashboard

**Location:** OnlinePay Dashboard → Administration → Advanced Settings → Notifications

**Add Webhook:**
- URL: `https://yourdomain.com/api/webhooks/onlinepay?secret=<rotated_secret>`
- Payload: "Full event payload"
- Events:
  - ✅ "Checkout - Transaction succeeded"
  - ✅ "Checkout - Transaction failed"

**Test Notification:**
- Send test notification from dashboard
- Verify 200 OK response
- Check application logs for receipt

---

### 5. Pre-Deployment Testing (CST Environment)

**Complete Test Purchase:**
```bash
# 1. Switch to test mode temporarily
ONLINEPAY_MODE=test

# 2. Use test cards from Westpac documentation
# Approved: 5123456789012346
# Declined: 5123456789012353

# 3. Test sequence:
# - Create membership checkout
# - Complete payment on hosted page
# - Verify webhook received
# - Confirm order PAID
# - Verify membership activated
# - Test partial refund
# - Test full refund
# - Verify membership revoked
```

**Verification Steps:**
```bash
# Run all tests
npm run test:checkout

# Expected: ✔ 35 tests passing

# Build production bundle
npm run build

# Expected: Build completed successfully

# Type check
npm run type-check

# Expected: No errors
```

---

## ✅ Post-Deployment Verification

### 1. Test Membership Purchase
- [ ] Navigate to `/membership`
- [ ] Click "Join Membership"
- [ ] Fill in billing details
- [ ] Complete payment on OnlinePay hosted page
- [ ] Verify redirect to order confirmation
- [ ] Verify membership activated (Crown badge appears)
- [ ] Check order in admin panel shows PAID status

### 2. Test Membership Benefits
- [ ] Log in as member
- [ ] Add products to cart
- [ ] Verify member pricing applied
- [ ] Verify free shipping shows for members
- [ ] Complete checkout (should be free shipping)

### 3. Test Refund Functionality
- [ ] Log in as admin
- [ ] Navigate to Orders panel
- [ ] Open a paid membership order
- [ ] Click "Refund Order"
- [ ] Enter partial amount (e.g., 50% of total)
- [ ] Verify refund processes successfully
- [ ] Verify membership still active
- [ ] Complete full refund (remaining amount)
- [ ] Verify membership revoked
- [ ] Check user no longer has Crown badge

### 4. Monitor Logs
```bash
# Watch for critical errors
grep -i "CRITICAL" application.log
grep -i "admin refund" application.log
grep -i "membership checkout" application.log

# Expected: No CRITICAL errors in normal operation
```

---

## 🔔 Monitoring Setup

### CloudWatch/Sentry Alerts

**Critical Alerts (Page Immediately):**
```
Pattern: "[admin refund] CRITICAL: PayWay refund succeeded but DB update failed"
Action: Manual database reconciliation required
```

**High Priority Alerts:**
```
Pattern: "[onlinepay webhook] ONLINEPAY_WEBHOOK_SECRET is not configured"
Threshold: 1 occurrence
Action: Fix environment configuration immediately
```

**Warning Alerts:**
```
Pattern: "[membership checkout] Unable to create or record hosted checkout"
Threshold: 5 occurrences in 10 minutes
Action: Check OnlinePay API status
```

### Health Check Endpoints
- `/api/health` - Application health
- Monitor 5xx rate on:
  - `/api/membership/checkout`
  - `/api/orders/[id]/poll-payment`
  - `/api/webhooks/onlinepay`

---

## 🛡️ Security Checklist

- [ ] Webhook secret rotated and updated in both app and Westpac
- [ ] No secrets in environment files committed to git
- [ ] HTTPS enforced for all production URLs
- [ ] Database migrations applied before code deployment
- [ ] Admin routes require `role === "ADMIN"`
- [ ] Webhook endpoint validates secret header
- [ ] Payment verification done server-side only
- [ ] Test mode disabled in production (`ONLINEPAY_MODE=live`)

---

## 🔄 Rollback Plan

If critical issues occur after deployment:

### Option 1: Disable OnlinePay (Quick)
```env
# Switch back to previous gateway
PAYMENT_GATEWAY=payway
NEXT_PUBLIC_PAYMENT_GATEWAY=payway
```

### Option 2: Full Rollback
```bash
# Revert to previous git commit
git revert <deployment_commit>

# Redeploy previous version
npm run build && npm start
```

### Option 3: Emergency Maintenance
```env
# Disable membership purchases temporarily
# Remove this to re-enable
MAINTENANCE_MODE=true
```

**Note:** Existing members and orders are unaffected by gateway changes. Only new purchases require the configured gateway.

---

## 📞 Support Contacts

**Westpac OnlinePay Support:**
- Phone: [Merchant support number]
- Email: [Support email]
- Dashboard: https://merchants.westpac.com.au/onlinepay

**Internal Escalation:**
- Database issues: DBA team
- Payment failures: Finance team
- Customer refunds: Customer service manager

---

## 📝 Deployment Timeline

**Recommended Schedule:**
1. **Day -1:** Complete all pre-deployment testing in CST environment
2. **Day 0, 9AM:** Deploy during low-traffic window
3. **Day 0, 9:30AM:** Verify health checks and monitoring
4. **Day 0, 10AM:** Complete post-deployment verification
5. **Day 0-7:** Monitor logs and customer reports closely
6. **Day 7:** Review metrics and identify any patterns

**Low-Traffic Windows:**
- Weekday mornings (9AM-11AM AEST)
- Avoid: Friday afternoons, weekends, sale events

---

## ✅ Final Sign-Off

Before marking deployment complete:

- [ ] All tests passing (35/35)
- [ ] Webhook secret rotated
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Westpac webhook configured
- [ ] Test purchase completed successfully
- [ ] Test refund completed successfully
- [ ] Monitoring and alerts configured
- [ ] Rollback plan documented and tested
- [ ] Team trained on new refund process

**Deployed by:** ________________  
**Date:** ________________  
**Version:** CompleteHomeSollution v0.1.0  
**Gateway:** Westpac OnlinePay (LIVE)

---

**Questions?** Review `MEMBERSHIP_REFUND_SECURITY_VERIFICATION.md` for detailed security analysis.
