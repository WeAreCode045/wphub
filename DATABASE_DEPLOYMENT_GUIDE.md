# Database Migration Deployment Guide

## 🚀 Deploy Database Schema

Your database migration is ready. Here's how to deploy it:

### Option 1: Supabase Dashboard (RECOMMENDED)

**Fastest and easiest way - 5 minutes:**

1. Open Supabase Dashboard:
   https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/sql

2. Click **"New Query"**

3. Copy the entire SQL from this file:
   ```
   supabase/migrations/20260103_stripe_elements_extended_subscriptions.sql
   ```

4. Paste it into the SQL editor

5. Click **"Run"** button

6. Wait for success message (should say "Query executed successfully")

7. Verify tables were created:
   - Go to: https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/explorer
   - Look for new tables in the left sidebar:
     - subscription_events
     - payment_failures
     - coupons
     - coupon_usage
     - admin_subscription_settings

### Option 2: Supabase CLI

**If you have database password:**

```bash
cd /Volumes/Code045Disk/Projects/Applications/wphub
supabase db push --linked
# When prompted, enter your Supabase database password
```

### Option 3: Direct PostgreSQL Connection

**If you have psql installed and database password:**

```bash
# Get your connection info from Supabase Dashboard
# Settings → Database → Connection string

psql postgresql://postgres.ossyxxlplvqakowiwbok:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres \
  -f supabase/migrations/20260103_stripe_elements_extended_subscriptions.sql
```

---

## 📊 What Gets Created

### New Tables (5)

1. **subscription_events**
   - Audit trail of all subscription changes
   - Linked to subscriptions and users
   - Stores event_data as JSONB

2. **payment_failures**
   - Records of failed payment attempts
   - Tracks status: pending, retrying, resolved, forgiven, canceled
   - Enables dunning workflow

3. **coupons**
   - Promotional discount codes
   - Synced with Stripe
   - Supports percentage and fixed amount discounts
   - Tracks max redemptions and expiration

4. **coupon_usage**
   - Redemption tracking
   - Prevents double-use
   - Tracks user-coupon relationships

5. **admin_subscription_settings**
   - Platform-wide configuration
   - Dunning grace periods
   - Proration behavior
   - Default admin settings

### Database Views (2)

1. **payment_failure_stats**
   - Daily aggregation of failures
   - Status breakdown
   - Retry statistics

2. **subscription_churn_analysis**
   - Monthly metrics
   - Canceled vs renewed counts
   - Churn rate calculation

### Indexes (13+)

Created for optimal query performance:
- subscription_events indexes (3)
- payment_failures indexes (4)
- coupons indexes (4)
- admin_subscription_settings index (1)
- coupon_usage indexes (3)

### Security

- **RLS (Row-Level Security)** policies enabled on:
  - subscription_events (users see own only)
  - payment_failures (admin only)
  - coupon_usage (users see own only)
  - coupons (admin managed)

---

## ✅ Verification Steps

After deployment, verify everything worked:

### 1. Check Tables

In Supabase Dashboard → Explorer, verify:
```
✅ public.subscription_events
✅ public.payment_failures
✅ public.coupons
✅ public.coupon_usage
✅ public.admin_subscription_settings
```

### 2. Check Views

```sql
-- In Supabase SQL Editor, run:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('payment_failure_stats', 'subscription_churn_analysis');
```

Expected result: 2 rows (both views)

### 3. Check Users Table Extensions

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users' 
AND column_name IN ('subscription_paused_at', 'pause_reason', 'pausable_until');
```

Expected result: 3 rows (all columns added)

### 4. Check Subscription Plans Extensions

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'subscription_plans' 
AND column_name IN ('is_hidden', 'sort_order', 'features_list');
```

Expected result: 3 rows (all columns added)

---

## 🚨 Troubleshooting

### Error: "Already exists, skipping"
**This is normal!** The migration uses `IF NOT EXISTS` clauses, so it's safe to run multiple times.

### Error: "Permission denied"
**Check**: Your Supabase account has admin access to the project.

### Error: "Column does not exist"
**This shouldn't happen** as we've fixed the schema issues. If it does, try:
1. Copy just the problematic table SQL
2. Run it separately in SQL Editor
3. Or contact Supabase support

### Timeout?
**For large migrations**, the CLI might timeout. Use the Dashboard option instead - it handles larger queries better.

---

## 📋 After Deployment

Once the migration is complete:

1. ✅ Database schema is deployed
2. ✅ All 8 edge functions are already live
3. ✅ All React components are ready to integrate
4. ✅ Admin dashboard is accessible at `/AdminSubscriptionDashboard`

**Next steps:**

1. **Configure Stripe Webhooks**
   - Endpoint: `https://ossyxxlplvqakowiwbok.supabase.co/functions/v1/webhook-stripe-sync`
   - Events: 7 types (see DEPLOYMENT_STRIPE_ELEMENTS.md)

2. **Integrate Components**
   - Update Checkout.jsx with PaymentElement
   - Add pause/resume to BillingAccount.tsx
   - Add coupon management to FinanceSettings.jsx

3. **Run Tests**
   - Test all 8 edge functions
   - Test webhook events
   - Test RLS policies

---

## 🆘 Need Help?

- **Supabase Dashboard**: https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok
- **Migration File**: `supabase/migrations/20260103_stripe_elements_extended_subscriptions.sql`
- **SQL Editor**: https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/sql
- **Documentation**: See DEPLOYMENT_STRIPE_ELEMENTS.md

---

**Status**: Migration ready to deploy ✨  
**Time to deploy**: ~5 minutes via Dashboard  
**Expected success**: 100% (uses IF NOT EXISTS clauses)
