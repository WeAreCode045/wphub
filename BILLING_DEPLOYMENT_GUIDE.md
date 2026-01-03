# Billing System Deployment Guide

## ✅ Completed Tasks

### 1. Package.json Dependencies Added
- ✅ `stripe@^14.21.0` - Stripe API client
- ✅ `@stripe/react-stripe-js@^2.7.3` - React Stripe provider
- ✅ `@stripe/stripe-js@^3.4.0` - Stripe.js library
- ✅ Dependencies installed via `pnpm install`

### 2. Edge Functions Deployed to Supabase
All 8 billing edge functions are now **ACTIVE** and deployed:

| Function | Status | Deployed |
|----------|--------|----------|
| create-stripe-customer | ✅ ACTIVE | 2026-01-03 06:51:55 |
| create-subscription | ✅ ACTIVE | 2026-01-03 06:51:59 |
| update-subscription | ✅ ACTIVE | 2026-01-03 06:52:00 |
| cancel-subscription | ✅ ACTIVE | 2026-01-03 06:52:01 |
| update-payment-method | ✅ ACTIVE | 2026-01-03 06:52:02 |
| upcoming-invoice | ✅ ACTIVE | 2026-01-03 06:52:03 |
| admin-create-plan | ✅ ACTIVE | 2026-01-03 06:52:04 |
| admin-update-plan | ✅ ACTIVE | 2026-01-03 06:52:04 |

Access them at: `https://<project-ref>.supabase.co/functions/v1/<function-name>`

---

## ⚠️ Remaining: Database Schema Deployment

The billing system schema migration exists at:
```
supabase/migrations/20250103_create_billing_system.sql
```

### Option 1: Deploy via Supabase Dashboard (Recommended)

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select project "wphub" (ossyxxlplvqakowiwbok)
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy the entire contents of `supabase/migrations/20250103_create_billing_system.sql`
6. Paste into the query editor
7. Click **Run** button
8. Verify success - you should see tables created in the Schema Editor

### Option 2: Deploy via CLI with correct password

The CLI deployment requires your PostgreSQL database password (not Supabase password):

```bash
cd /Volumes/Code045Disk/Projects/Applications/wphub

# Use the correct database password when prompted
supabase db push
```

If you don't have the password, get it from:
1. Supabase Dashboard → Project Settings → Database → Connection String
2. Extract the password from the connection string: `postgresql://postgres:<PASSWORD>@...`

### Option 3: SQL Dump and Apply

If the above don't work, you can execute the SQL directly using psql:

```bash
# Get connection details from Supabase dashboard
psql -h <host> -U postgres -d postgres < supabase/migrations/20250103_create_billing_system.sql
```

---

## 📋 Schema Contents

The migration creates:

### Tables
- `public.subscription_plans` - Admin-managed billing plans (linked to Stripe products)
- `stripe.customers` - Synced Stripe customer data (read-only)
- `stripe.products` - Synced Stripe products (read-only)
- `stripe.prices` - Synced Stripe prices (read-only)
- `stripe.subscriptions` - Synced Stripe subscriptions (read-only)
- `stripe.invoices` - Synced Stripe invoices (read-only)
- `stripe.payment_methods` - Synced Stripe payment methods (read-only)
- `public.stripe_sync_log` - Webhook sync tracking

### Views
- `user_subscriptions` - User + subscription + plan details join
- `active_subscriptions` - Currently active subscriptions

### Functions
- `get_user_active_subscription()` - Get user's current subscription
- `get_plan_metadata(plan_id)` - Get plan feature metadata

### RLS Policies
- Users can only see their own subscriptions
- Admins can see all subscription plans
- Read-only policies on stripe.* tables

### Indexes
- Foreign key indexes for performance
- Search and filter indexes

---

## 🔑 Environment Variables Needed

### For Frontend (.env.local or .env):
```env
VITE_STRIPE_PUBLIC_KEY=pk_test_... or pk_live_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### For Edge Functions (set in Supabase Dashboard → Function Settings):

For each function, set these secrets:
```
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Or add to `.env.local` which Supabase CLI will use:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 🧪 Verify Deployment

After deploying the schema, verify with these queries in SQL Editor:

```sql
-- Check subscription_plans table exists
SELECT COUNT(*) as plan_count FROM public.subscription_plans;

-- Check stripe.customers table exists
SELECT COUNT(*) as customer_count FROM stripe.customers;

-- Check views exist
SELECT * FROM information_schema.views WHERE table_schema = 'public' 
  AND table_name IN ('user_subscriptions', 'active_subscriptions');

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name LIKE 'get_%';
```

All should return successfully.

---

## 🚀 Next Steps After Schema Deployment

1. **Update AuthContext** to call `create-stripe-customer` function on user signup:
   ```typescript
   // In src/lib/AuthContext.jsx - after successful signup
   const { data, error } = await supabase.functions.invoke('create-stripe-customer', {
     headers: { Authorization: `Bearer ${session.access_token}` }
   });
   ```

2. **Add Pricing Page** to your routing in `src/pages.config.js`:
   ```javascript
   { path: '/pricing', component: 'Pricing', layout: 'default' }
   ```

3. **Add Billing Account Page**:
   ```javascript
   { path: '/account/billing', component: 'BillingAccount', layout: 'default' }
   ```

4. **Add Stripe Provider** to your main app layout in `src/Layout.jsx`:
   ```typescript
   import { Elements } from '@stripe/react-stripe-js';
   import { loadStripe } from '@stripe/stripe-js';
   
   const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
   
   export default function Layout({ children }) {
     return (
       <Elements stripe={stripePromise}>
         {children}
       </Elements>
     );
   }
   ```

5. **Configure Stripe Webhook** in your Stripe Dashboard:
   - Endpoint URL: `https://<project-ref>.supabase.co/functions/v1/handleStripeWebhook`
   - Events to listen for: `customer.created`, `customer.updated`, `customer.deleted`, `product.created`, `product.updated`, `product.deleted`, `price.created`, `price.updated`, `price.deleted`, `subscription.created`, `subscription.updated`, `subscription.deleted`, `invoice.created`, `invoice.updated`, `payment_method.attached`, `payment_method.detached`

6. **Test End-to-End**:
   - Go to `/pricing` and see plans loaded from Stripe
   - Create a subscription with test card `4242 4242 4242 4242`
   - Check user subscription in database
   - Visit `/account/billing` to manage subscription

---

## 📞 Troubleshooting

### "Insufficient privileges" error
- Check Supabase service role key has correct permissions
- Verify the role executing migrations is `postgres`

### Edge function returns 401
- Check `STRIPE_SECRET_KEY` is set correctly
- Verify JWT token is being passed in Authorization header

### Stripe sync tables are empty
- Deploy the Stripe webhook handler if not already deployed
- Trigger test webhook from Stripe Dashboard
- Check `stripe_sync_log` table for webhook processing errors

### Can't find Tables in SQL Editor after running migration
- Refresh the browser (Cmd+R or Ctrl+R)
- Logout and login to Supabase dashboard
- Check error messages in the SQL Editor output

---

## 📚 Related Documentation

- [STRIPE_SYNC_INTEGRATION.md](./STRIPE_SYNC_INTEGRATION.md) - Webhook architecture
- [BILLING_SYSTEM_README.md](./BILLING_SYSTEM_README.md) - System overview
- [BILLING_IMPLEMENTATION_GUIDE.md](./BILLING_IMPLEMENTATION_GUIDE.md) - Step-by-step guide
- [BILLING_INTEGRATION_POINTS.md](./BILLING_INTEGRATION_POINTS.md) - Integration checkpoints
- [BILLING_QUICK_REFERENCE.md](./BILLING_QUICK_REFERENCE.md) - API reference

---

**Status**: ✅ Edge Functions Deployed | ⏳ Database Schema - Manual Deployment Required
