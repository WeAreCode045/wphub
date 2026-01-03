# Billing System Admin Setup

## Status: Configuration Required

The billing system infrastructure is complete, but requires manual setup to work.

## What's Been Done

✅ **Database Migration**: Added `role` column to `public.users` table  
✅ **Edge Functions**: Updated `admin-create-plan` and `admin-update-plan` to check role from database  
✅ **Frontend Pages**: Created ProductManagement, SubscriptionOverview, and BillingAccount pages  
✅ **Database Entities**: Added SubscriptionPlan and UserSubscription management  

## What You Need to Do

### 1. Run the Migration

Run the Supabase migration to add the `role` column:

```bash
supabase migration up
# or deploy to your Supabase project via the dashboard
```

Or manually execute in Supabase SQL editor:
```sql
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
```

### 2. Set Your User as Admin

Get your user ID from the Supabase auth dashboard, then run in the SQL editor:

```sql
UPDATE public.users 
SET role = 'admin' 
WHERE id = 'YOUR_USER_ID';
```

### 3. Add Stripe Public Key to .env

Get your Stripe publishable key from [Stripe Dashboard](https://dashboard.stripe.com/apikeys):

1. Go to Stripe Dashboard → Developers → API Keys
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Add to your `.env` file:

```env
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_FULL_KEY_HERE
```

## How to Test

1. **Set Up Database**:
   - Run the migration
   - Set your user as admin

2. **Test Admin Panel**:
   - Go to admin dashboard ("Producten" in Business section)
   - Create a test subscription product
   - Fill in: name, description, monthly/yearly prices, features, trial days

3. **Expected Flow**:
   - Click "Create Plan"
   - Frontend calls `admin-create-plan` edge function with Bearer token
   - Edge function verifies you're admin (checks `public.users.role`)
   - Creates Stripe Product + Prices automatically
   - Saves mapping to `public.subscription_plans` table
   - Shows success toast and refreshes product list

4. **Check Results**:
   - Product appears in dashboard
   - Check Stripe dashboard for product creation
   - Run: `SELECT * FROM public.subscription_plans;` to see database entry

## Troubleshooting

**Error: "You do not have permission to access this page"**
- ✓ Check that your `public.users.role = 'admin'` in database
- ✓ Refresh the page to reload user data

**Error: "401 Unauthorized" when creating product**
- ✓ Verify Bearer token is being sent (check browser Network tab)
- ✓ Check that `public.users.role = 'admin'` for your user
- ✓ Verify `SUPABASE_SERVICE_ROLE_KEY` is set in edge function environment

**Error: "Please call Stripe() with your publishable key"**
- ✓ Add `VITE_STRIPE_PUBLIC_KEY` to your `.env` file
- ✓ The key should start with `pk_test_` (test mode) or `pk_live_` (production)

**Product creation works but no Stripe product created**
- ✓ Check Stripe API key in edge function environment (`STRIPE_SECRET_KEY`)
- ✓ Check edge function logs in Supabase dashboard
- ✓ Verify Stripe account is set up and API keys are valid

## Database Schema

After migration, your `public.users` table will have:

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID | - | Primary key, from auth.users |
| role | VARCHAR(50) | 'user' | **NEW**: 'user', 'admin', etc. |
| stripe_customer_id | VARCHAR(255) | NULL | Stripe customer for billing |
| created_at | TIMESTAMPTZ | NOW() | User creation timestamp |
| ... | ... | ... | Other existing columns |

## Key Files Modified

- `supabase/migrations/20250103_create_billing_system.sql` - Added `role` column
- `supabase/functions/admin-create-plan/index.ts` - Fixed auth check
- `supabase/functions/admin-update-plan/index.ts` - Fixed auth check
- `src/pages/ProductManagement.jsx` - Admin product creation
- `src/pages/SubscriptionOverview.jsx` - Admin subscription view
- `src/pages/BillingAccount.tsx` - User billing account
- `src/pages/Pricing.tsx` - Public pricing page
- `.env` - Added `VITE_STRIPE_PUBLIC_KEY` placeholder

## Next Steps

After completing setup, you can:

1. **Create subscription plans** via ProductManagement page
2. **View user subscriptions** via SubscriptionOverview page
3. **Manage your account** in BillingAccount page
4. **Display public pricing** on Pricing page
5. **Integrate Stripe webhooks** for subscription lifecycle events

See [BILLING_SYSTEM_README.md](./BILLING_SYSTEM_README.md) for complete system documentation.
