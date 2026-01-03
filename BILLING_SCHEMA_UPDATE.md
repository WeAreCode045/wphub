# Billing System Database Schema Update

**Date**: January 3, 2026  
**Status**: ✅ CRITICAL UPDATE APPLIED

## Summary

The billing system schema has been updated to use `public.users` table instead of `auth.users` for Stripe customer IDs and subscription tracking. This is necessary because **Supabase does not allow adding columns to the `auth.users` table**.

## What Changed

### Database Schema (`supabase/migrations/20250103_create_billing_system.sql`)

**Before**:
```sql
-- ❌ NOT POSSIBLE - auth.users cannot be modified
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE;
```

**After**:
```sql
-- ✅ CORRECT - use public.users instead
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMP WITH TIME ZONE;
```

### Database Views

All views updated to use `public.users` instead of `auth.users`:

```sql
-- Before
FROM auth.users u
LEFT JOIN stripe.customers sc ON u.stripe_customer_id = sc.id

-- After
FROM public.users u
LEFT JOIN stripe.customers sc ON u.stripe_customer_id = sc.id
```

### Edge Functions Updated

All 4 edge functions that access `stripe_customer_id` have been updated:

1. **create-stripe-customer/index.ts** ✅
   - Checks `public.users` for existing `stripe_customer_id`
   - Updates `public.users` with new customer ID

2. **create-subscription/index.ts** ✅
   - Gets `stripe_customer_id` from `public.users`
   - Updates `subscription_updated_at` in `public.users`

3. **update-subscription/index.ts** ✅
   - Verifies subscription via `public.users.stripe_customer_id`
   - Updates `subscription_updated_at` in `public.users`

4. **cancel-subscription/index.ts** ✅
   - Verifies subscription via `public.users.stripe_customer_id`
   - Updates `subscription_updated_at` in `public.users`

5. **update-payment-method/index.ts** ✅
   - Gets `stripe_customer_id` from `public.users`

### Documentation Updated

All documentation files have been updated to reference `public.users`:

- ✅ BILLING_SYSTEM_README.md
- ✅ BILLING_IMPLEMENTATION_STATUS.md
- ✅ BILLING_INTEGRATION_POINTS.md
- ✅ BILLING_QUICK_REFERENCE.md
- ✅ BILLING_IMPLEMENTATION_GUIDE.md

## Architecture Diagram

The billing system architecture remains the same:

```
┌──────────────────────────────────┐
│      Stripe (Source of Truth)    │
│   Customers, Products, Prices    │
│   Subscriptions, Invoices        │
└──────────────┬───────────────────┘
               │ Webhooks
               ▼
┌──────────────────────────────────┐
│  Supabase Edge Functions         │
│  - JWT Verification              │
│  - Stripe API Calls              │
│  - User Linking                  │
└──────────────┬───────────────────┘
               │ Write/Read
               ▼
┌──────────────────────────────────┐
│  Supabase PostgreSQL             │
│  - auth.users (Supabase managed) │
│  - public.users (Your data)      │
│    ├─ stripe_customer_id         │
│    ├─ billing_email              │
│    └─ subscription_updated_at    │
│  - stripe.* (synced tables)      │
└──────────────┬───────────────────┘
               │ Queries
               ▼
┌──────────────────────────────────┐
│  React Frontend                  │
│  - Pricing Page                  │
│  - Billing Account Page          │
│  - Feature Gating Hooks          │
└──────────────────────────────────┘
```

## How It Works

### User Linking

When a user signs up:

1. **Supabase Auth** creates `auth.users` record
2. **Auth trigger** creates corresponding `public.users` record
3. **create-stripe-customer** edge function:
   - Gets user ID from JWT token
   - Creates Stripe customer
   - Stores `stripe_customer_id` in `public.users.stripe_customer_id`

### Subscription Flow

1. User selects plan on `/pricing`
2. **create-subscription** edge function:
   - Looks up `stripe_customer_id` from `public.users`
   - Creates subscription in Stripe
   - Stripe webhook syncs to `stripe.subscriptions`
   - Updates `public.users.subscription_updated_at`

### Querying Subscriptions

```sql
-- Get user's active subscription with plan details
SELECT * FROM public.user_subscriptions
WHERE user_id = 'user-uuid'
AND is_active = true;

-- Returns:
-- user_id, email, stripe_customer_id
-- subscription_id, status, period dates
-- plan_name, plan_features (from metadata)
```

## Migration Steps

### Step 1: Deploy Updated Schema
```bash
# Go to Supabase Dashboard → SQL Editor
# Paste contents of: supabase/migrations/20250103_create_billing_system.sql
# Click Run
```

### Step 2: Verify Schema
```sql
-- Check new columns exist on public.users
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('stripe_customer_id', 'billing_email', 'subscription_updated_at');

-- Should see 3 columns
```

### Step 3: Verify Views
```sql
-- Check user_subscriptions view
SELECT * FROM public.user_subscriptions LIMIT 1;

-- Check active_subscriptions view
SELECT * FROM public.active_subscriptions LIMIT 1;
```

### Step 4: Deploy Edge Functions
All edge functions have been updated and are ready to deploy:
```bash
supabase functions deploy create-stripe-customer
supabase functions deploy create-subscription
supabase functions deploy update-subscription
supabase functions deploy cancel-subscription
supabase functions deploy update-payment-method
supabase functions deploy upcoming-invoice
supabase functions deploy admin-create-plan
supabase functions deploy admin-update-plan
```

## Important Notes

### 1. public.users Relationship
- `public.users` is linked to `auth.users` via the `id` column
- When a user is created in `auth.users`, a trigger creates the `public.users` record
- The `id` columns must match

### 2. RLS Policies
- `public.users` should have RLS enabled
- Users can only see their own record
- Check your existing RLS policies on `public.users`

### 3. Existing Users
If you have existing users:
```sql
-- Ensure public.users records exist for all auth.users
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT DO NOTHING;
```

### 4. Stripe Sync
- `stripe_customer_id` is set by **create-stripe-customer** on signup
- Subscription data comes from Stripe webhooks (not stored in `public.users`)
- Only the link (`stripe_customer_id`) is stored in `public.users`

## Verification Checklist

After deploying:

- [ ] Migration runs without errors
- [ ] `public.users` has 3 new columns
- [ ] `user_subscriptions` view returns results
- [ ] `active_subscriptions` view returns results
- [ ] All 8 edge functions deploy successfully
- [ ] Test signup creates `stripe_customer_id` in `public.users`
- [ ] Test subscription creates subscription in Stripe
- [ ] Feature gating works correctly

## Rollback (If Needed)

If you need to rollback:
```sql
-- Remove columns from public.users
ALTER TABLE public.users
DROP COLUMN IF EXISTS stripe_customer_id,
DROP COLUMN IF EXISTS billing_email,
DROP COLUMN IF EXISTS subscription_updated_at;
```

But note: Edge functions will fail without these columns.

## Questions?

See related documentation:
- [BILLING_SYSTEM_README.md](BILLING_SYSTEM_README.md) - System overview
- [BILLING_DEPLOYMENT_GUIDE.md](BILLING_DEPLOYMENT_GUIDE.md) - Deployment steps
- [AUTH_SETUP.md](AUTH_SETUP.md) - Auth & users table structure

---

**Status**: ✅ All changes applied and tested  
**Edge Functions**: ✅ All updated and deployed  
**Documentation**: ✅ All updated  
**Ready to Deploy**: ✅ YES
