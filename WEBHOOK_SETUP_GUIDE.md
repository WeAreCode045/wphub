# 🔗 Stripe Webhook Configuration Guide

## Overview

This guide walks you through setting up Stripe webhooks to enable real-time event processing for your wphub subscription system. Webhooks allow Stripe to notify your system immediately when important payment and subscription events occur.

---

## ✅ Prerequisites

- Stripe account with API access (prod or test mode)
- Admin access to Stripe Dashboard
- Your Supabase project webhook endpoint URL
- Database migration deployed (✅ Already done)
- Edge functions deployed (✅ Already done)

---

## 🎯 What Webhooks Do

Webhooks automatically sync data between Stripe and your system when:
- Payments succeed or fail
- Subscriptions are created, updated, or cancelled
- Invoices are paid or fail payment
- This enables the **dunning workflow** (payment retry system)

---

## 📋 7 Webhook Events to Configure

### 1️⃣ **payment_intent.succeeded**
- **Triggers:** Customer successfully completes payment
- **Action:** Mark payment as successful, update subscription status
- **Impact:** Users gain access immediately after payment

### 2️⃣ **payment_intent.payment_failed**
- **Triggers:** Payment attempt fails
- **Action:** Create payment failure record, trigger dunning workflow
- **Impact:** System attempts to retry payment per dunning schedule

### 3️⃣ **customer.subscription.created**
- **Triggers:** New subscription created in Stripe
- **Action:** Log subscription creation event
- **Impact:** Track subscription lifecycle

### 4️⃣ **customer.subscription.updated**
- **Triggers:** Subscription modified (plan change, pause, etc.)
- **Action:** Update subscription record, log event
- **Impact:** Reflect subscription changes in real-time

### 5️⃣ **customer.subscription.deleted**
- **Triggers:** Subscription cancelled or expired
- **Action:** Log cancellation, update subscription status
- **Impact:** Revoke access, track churn

### 6️⃣ **invoice.paid**
- **Triggers:** Invoice payment succeeds
- **Action:** Update invoice status, mark as paid
- **Impact:** Accurate billing records

### 7️⃣ **invoice.payment_failed**
- **Triggers:** Invoice payment fails
- **Action:** Create payment failure record, trigger retry
- **Impact:** Enable dunning workflow recovery

---

## 🚀 Step-by-Step Setup

### STEP 1: Get Your Webhook Endpoint URL

Your webhook endpoint is hosted on Supabase:

```
https://ossyxxlplvqakowiwbok.supabase.co/functions/v1/webhook-stripe-sync
```

**Note:** Replace `ossyxxlplvqakowiwbok` with your actual Supabase project ID if different.

To verify your project ID:
```bash
# Check your supabase config
grep project_id supabase/config.toml
```

### STEP 2: Open Stripe Dashboard

1. Go to: https://dashboard.stripe.com
2. Sign in to your Stripe account
3. Select your account (test or production mode)
4. Navigate to: **Developers** → **Webhooks**

### STEP 3: Add Webhook Endpoint

1. Click **Add Endpoint** button
2. Enter endpoint URL: `https://ossyxxlplvqakowiwbok.supabase.co/functions/v1/webhook-stripe-sync`
3. Click **Select events** button

### STEP 4: Select the 7 Events

In the event selection dialog:

**Search and select these events:**

- [ ] `payment_intent.succeeded`
- [ ] `payment_intent.payment_failed`
- [ ] `customer.subscription.created`
- [ ] `customer.subscription.updated`
- [ ] `customer.subscription.deleted`
- [ ] `invoice.paid`
- [ ] `invoice.payment_failed`

**Click:** Select Events → Add Events

### STEP 5: Review & Create

1. Review the endpoint configuration:
   - URL: Your Supabase webhook endpoint ✅
   - Events: All 7 events selected ✅
   - Version: Latest API version ✅

2. Click **Create Endpoint**

3. **Copy the Signing Secret** (starts with `whsec_`)
   - This is needed for webhook verification
   - You can copy it later from the endpoint details

### STEP 6: Verify in Dashboard

After creation, you should see:
- ✅ Endpoint URL active
- ✅ 7 events configured
- ✅ Status: "Enabled"
- ✅ Recent deliveries (once events start flowing)

---

## 🔐 Security

Your webhook endpoint is secured by:

1. **Webhook Signing Secret** verification
   - Stripe signs each webhook with your secret
   - Edge function validates signature
   - Prevents spoofed webhooks

2. **HTTPS Only**
   - Supabase functions use HTTPS
   - Data encrypted in transit

3. **Request Validation**
   - Edge function verifies Stripe signature
   - Rejects invalid or tampered events

---

## 🧪 Testing Webhooks

### Test 1: Manual Event Trigger (Easiest)

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click your endpoint URL
3. Click **Send test event** button
4. Select an event type (e.g., `customer.subscription.created`)
5. Click **Send test event**
6. Check your edge function logs for processing

### Test 2: Real Payment Flow

1. Go to your app checkout page
2. Use Stripe test card: `4242 4242 4242 4242`
3. Enter any future expiry and CVC
4. Complete checkout
5. Watch webhooks fire in Stripe Dashboard

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Require authentication: `4000 0025 0000 3155`

### Test 3: Check Logs

1. Go to **Supabase Dashboard**
   - https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/functions

2. Click **webhook-stripe-sync** function

3. View **Logs** tab to see:
   - Incoming webhook requests
   - Processing status
   - Any errors

---

## ✅ Verification Checklist

After setup, verify everything is working:

### In Stripe Dashboard:
- [ ] Webhook endpoint created
- [ ] URL is correct
- [ ] 7 events selected
- [ ] Status shows "Enabled"
- [ ] Recent deliveries show successful (green)

### In Supabase:
- [ ] webhook-stripe-sync function exists
- [ ] Logs show incoming requests
- [ ] No error messages in logs
- [ ] Processing completes (0 errors/timeouts)

### In Your Database:
- [ ] `subscription_events` table populated
- [ ] `payment_failures` table updated for failed payments
- [ ] `coupon_usage` tracked correctly

### In Your App:
- [ ] Test payment shows subscription as active
- [ ] Failed payment shows in BillingAccount
- [ ] Pause/resume reflects in Stripe

---

## 🔍 Monitoring Webhooks

### View Recent Deliveries

1. Stripe Dashboard → Developers → Webhooks
2. Click your endpoint
3. View **Recent Deliveries** table
4. Click any delivery to see:
   - Request payload
   - Response status
   - Processing time

### Check Event History

1. Stripe Dashboard → Developers → Events
2. Filter by event type
3. See all events sent from Stripe
4. Check delivery status

### Monitor Edge Function Logs

1. Supabase Dashboard → Functions
2. Click **webhook-stripe-sync**
3. View **Logs** tab
4. Search for errors or issues
5. Check performance metrics

---

## 🐛 Troubleshooting

### "Webhook endpoint not responding"

**Problem:** Stripe can't reach your endpoint
**Solutions:**
1. Verify URL is correct (copy from edge function details)
2. Check if Supabase functions are active
3. Ensure no firewall blocking webhooks
4. Wait a few minutes and retry

### "Bad request" or "Signature mismatch"

**Problem:** Webhook signature validation failed
**Solutions:**
1. Verify signing secret is correct in edge function
2. Check logs for validation errors
3. Ensure webhook secret matches Stripe endpoint
4. Test with manual event from dashboard

### "Function timeout"

**Problem:** Edge function taking too long
**Solutions:**
1. Check database queries in edge function
2. Optimize query performance
3. Check for database connection issues
4. Monitor function logs

### "Database error"

**Problem:** Unable to write to database
**Solutions:**
1. Verify RLS policies allow writes
2. Check column names match schema
3. Verify tables exist (migration ran)
4. Check for constraint violations

---

## 📊 What Gets Tracked

Once webhooks are active, your system automatically tracks:

### In `subscription_events` table:
- Every subscription change
- Timestamp of each event
- Event type (created, updated, deleted)
- Previous and new status
- Event metadata

### In `payment_failures` table:
- Failed payment attempts
- Retry count (auto-increments)
- Last retry timestamp
- Failure reason/code
- Status (pending, retrying, resolved)

### In `coupon_usage` table:
- When coupons are applied
- Which user applied it
- Discount amount
- Usage timestamp

---

## 🔄 Webhook Flow Diagram

```
Stripe Event
    ↓
Webhook fired to your endpoint
    ↓
Edge function receives event
    ↓
Verify Stripe signature
    ↓
Process event data
    ↓
Update database tables
    ↓
Send confirmation response to Stripe
    ↓
Stripe marks delivery as successful
```

---

## 📝 Event Payload Examples

### payment_intent.succeeded
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "status": "succeeded",
      "customer": "cus_XXXXXXXXX",
      "amount": 9999,
      "currency": "eur"
    }
  }
}
```

### customer.subscription.created
```json
{
  "type": "customer.subscription.created",
  "data": {
    "object": {
      "id": "sub_1234567890",
      "customer": "cus_XXXXXXXXX",
      "status": "active",
      "items": { "data": [{ "price": { "id": "price_XXXXX" } }] }
    }
  }
}
```

### invoice.payment_failed
```json
{
  "type": "invoice.payment_failed",
  "data": {
    "object": {
      "id": "in_1234567890",
      "customer": "cus_XXXXXXXXX",
      "subscription": "sub_XXXXXXXXX",
      "status": "open"
    }
  }
}
```

---

## 🎓 Next Steps

After webhooks are configured:

1. **Test each event** using Stripe test mode
2. **Monitor logs** in Supabase for 24 hours
3. **Verify database records** are being created
4. **Test dunning workflow** by triggering payment failures
5. **Switch to production** when confident (if ready)

---

## 📞 Support

If webhooks aren't working:

1. **Check Stripe logs**: Developers → Events → Recent API calls
2. **Check Supabase logs**: Functions → webhook-stripe-sync → Logs
3. **Check database**: Query tables to see if data is written
4. **Test manually**: Send test event from dashboard
5. **Review configuration**: Verify all 7 events are selected

---

## ✨ You're Ready!

Your Stripe webhook integration is now configured for:
- ✅ Real-time payment processing
- ✅ Subscription lifecycle tracking
- ✅ Dunning workflow automation
- ✅ Invoice management
- ✅ Coupon usage tracking

**Next:** Run your integration tests and monitor the logs! 🚀

---

**Date Setup:** January 3, 2026  
**Configuration:** 7 webhook events  
**Status:** Ready for testing  
**Documentation:** Complete
