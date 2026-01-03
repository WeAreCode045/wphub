# SUBSCRIPTION & BILLING SYSTEM - IMPLEMENTATION GUIDE

## Overview

This document provides a complete guide to the Stripe + Supabase subscription and billing system. All components work together to provide a secure, scalable, and maintainable SaaS billing infrastructure.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      STRIPE (Source of Truth)                    │
│  - Customers                                                      │
│  - Products & Prices                                             │
│  - Subscriptions                                                  │
│  - Invoices & Payment Methods                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                    Webhooks & APIs
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
┌──────────────────┐           ┌──────────────────────┐
│  Edge Functions  │           │  Stripe Sync Engine  │
│  (Write actions) │           │  (Async sync)        │
│                  │           │                      │
│ - create-*       │           │ Webhook Handler      │
│ - update-*       │           │ upsert stripe.*      │
│ - cancel-*       │           │                      │
└────────┬─────────┘           └──────────┬───────────┘
         │                                │
         │                                │
         └───────────────────┬────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     Supabase     │
                    │   PostgreSQL     │
                    │                  │
                    │ public.*         │
                    │ stripe.* (R/O)   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  React Frontend  │
                    │                  │
                    │ - Pricing Page   │
                    │ - Billing Page   │
                    │ - Feature Gating │
                    └──────────────────┘
```

## Implementation Checklist

### Phase 1: Database & Infrastructure

- ✅ **Database Schema** ([`supabase/migrations/20250103_create_billing_system.sql`](supabase/migrations/20250103_create_billing_system.sql))
  - Users table with `stripe_customer_id`
  - `subscription_plans` table (admin-managed)
  - `stripe.*` schema (read-only synced data)
  - Views for common queries
  - RLS policies
  - Helper functions

- ✅ **Stripe Sync Engine** ([`STRIPE_SYNC_INTEGRATION.md`](STRIPE_SYNC_INTEGRATION.md))
  - Webhook handler setup
  - Table sync patterns
  - Usage examples

### Phase 2: Backend (Edge Functions)

All Edge Functions are production-ready and handle:
- JWT verification
- Idempotency
- Proper error handling
- Stripe API calls with Service Role

#### User-Facing Functions

- ✅ **`create-stripe-customer`** - Called on user signup
  - Idempotent (checks if customer already exists)
  - Links Supabase user to Stripe customer
  - Sets metadata with `platform_user_id`

- ✅ **`create-subscription`** - User creates new subscription
  - Requires payment method ID
  - Fetches trial days from plan
  - Handles Stripe subscription creation
  - Supports metadata

- ✅ **`update-subscription`** - Upgrade/downgrade plans
  - Validates subscription belongs to user
  - Handles proration configuration
  - Updates subscription items

- ✅ **`cancel-subscription`** - Cancel at period end or immediately
  - Supports both cancel modes
  - Tracks cancellation metadata
  - Idempotent operation

- ✅ **`update-payment-method`** - Change default payment method
  - Attaches payment method to customer if needed
  - Updates subscription default method
  - Works with Stripe Elements

- ✅ **`upcoming-invoice`** - Fetch next invoice details
  - Gets upcoming invoice for active subscription
  - Shows amount due and payment date
  - Returns line items for display

#### Admin Functions

- ✅ **`admin-create-plan`** - Create new subscription plan
  - Creates Stripe Product
  - Creates monthly & yearly prices
  - Stores feature metadata
  - Saves plan in Supabase

- ✅ **`admin-update-plan`** - Modify existing plan
  - Updates product name/description
  - Creates new prices (prices are immutable)
  - Updates feature metadata
  - Updates Supabase record

### Phase 3: Frontend (React)

#### Utilities & Hooks

- ✅ **`useSubscriptionFeatures.ts`** - Comprehensive feature gating
  - `useUserSubscription()` - Get current subscription
  - `useCanCreateSite()` - Check site limit
  - `useCanUseProjects()` - Check feature access
  - `useCanUploadLocalPlugins()` - Check feature access
  - `useCanUploadLocalThemes()` - Check feature access
  - `useCanInviteTeamMembers()` - Check feature access
  - `useUserFeatures()` - Get all features summary
  - Standalone functions for non-React code
  - HOC for component wrapping

#### Pages

- ✅ **`Pricing.tsx`** - Pricing & subscription page
  - Display all public plans
  - Billing period toggle (monthly/yearly)
  - Show current plan indicator
  - Stripe Elements integration for payment
  - Checkout form
  - FAQ section
  - Proper error handling

- ✅ **`BillingAccount.tsx`** - User billing management
  - View current subscription
  - Upgrade/downgrade plan
  - Cancel subscription
  - View & download invoices
  - Manage payment methods
  - View upcoming invoice
  - Tabbed interface for organization

## Configuration

### Environment Variables

Add these to your `.env.local` and Supabase:

```env
# Frontend
VITE_STRIPE_PUBLIC_KEY=pk_live_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Supabase (Service Role, for Edge Functions)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Stripe Configuration

1. **Products & Prices**
   - Create products with metadata for features
   - Create monthly and yearly prices
   - Set lookup_keys for easy references

2. **Webhook Endpoints**
   - Configure webhook to your Edge Function
   - Events to listen:
     ```
     customer.created, customer.updated, customer.deleted
     product.created, product.updated, product.deleted
     price.created, price.updated, price.deleted
     customer.subscription.created, customer.subscription.updated, customer.subscription.deleted
     invoice.created, invoice.updated
     payment_method.attached, payment_method.detached, payment_method.updated
     ```

3. **Webhook Secret**
   - Store `STRIPE_WEBHOOK_SECRET` from Stripe Dashboard
   - Use in Edge Function for signature verification

## Usage Examples

### Example 1: New User Registration

```typescript
// 1. User signs up via Supabase Auth (auth.signUp)
// 2. In signup callback, create Stripe customer:

async function onUserSignup(userId: string, email: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create-stripe-customer`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    }
  );
  
  // Stripe Sync Engine will sync the customer into stripe.customers
}
```

### Example 2: Check Feature Access in Component

```typescript
import { useCanCreateSite, useCanInviteTeamMembers } from "@/hooks/useSubscriptionFeatures";

export function MyComponent() {
  const { can_create, sites_remaining } = useCanCreateSite(currentSiteCount);
  const { can_invite } = useCanInviteTeamMembers();

  return (
    <>
      {can_create ? (
        <button onClick={createNewSite}>Create Site</button>
      ) : (
        <div>You've reached your site limit. Upgrade to create more sites.</div>
      )}

      {!can_invite && (
        <p>Team invites are not available in your plan.</p>
      )}
    </>
  );
}
```

### Example 3: Upgrade/Downgrade Subscription

```typescript
async function upgradeSubscription(newPriceId: string) {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/update-subscription`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription_id: currentSubscription.id,
        price_id: newPriceId,
        proration_behavior: "create_invoices", // Charge/credit the difference
      }),
    }
  );

  const result = await response.json();
  // Subscription updated in Stripe
  // Stripe Sync Engine will sync changes to supabase
}
```

### Example 4: Admin Create Plan

```typescript
async function createPlan() {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-create-plan`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Pro Plan",
        description: "For growing teams",
        monthly_price_cents: 2999,  // $29.99
        yearly_price_cents: 29990,  // $299.90 (20% discount)
        trial_days: 14,
        position: 2,
        is_public: true,
        features: {
          limits_sites: 10,
          feature_projects: true,
          feature_local_plugins: true,
          feature_local_themes: true,
          feature_team_invites: true,
        },
      }),
    }
  );

  const plan = await response.json();
  // Stripe Product + Prices created
  // Plan stored in subscription_plans table
}
```

## Data Flow Diagrams

### Subscription Creation Flow

```
User Selects Plan
      │
      ▼
Create PaymentMethod (Stripe.js on frontend)
      │
      ▼
Call create-subscription Edge Function
      │
      ├─► Verify JWT
      ├─► Get user's stripe_customer_id
      ├─► Call stripe.subscriptions.create()
      │
      ▼
Stripe Creates Subscription
      │
      ├─► Stripe webhook: customer.subscription.created
      │
      ▼
Stripe Sync Engine
      │
      ├─► Receives webhook
      ├─► Upserts into stripe.subscriptions
      ├─► Upserts into stripe.prices (if new)
      │
      ▼
Frontend Queries user_subscriptions View
      │
      └─► Gets subscription + plan details
          (data is now available for display)
```

### Feature Access Check Flow

```
Component Rendered
      │
      ▼
useCanInviteTeamMembers() hook
      │
      ├─► useUserSubscription() fetches from user_subscriptions view
      │   ├─► user_subscriptions view JOINs:
      │   │   - public.users
      │   │   - stripe.customers
      │   │   - stripe.subscriptions
      │   │   - stripe.products
      │   │
      │   └─► Returns plan_features (from stripe.products.metadata)
      │
      ▼
Check subscription.plan_features.feature_team_invites
      │
      ▼
Display UI accordingly
```

## Best Practices

### 1. Always Verify Ownership
When updating a subscription, always verify it belongs to the authenticated user:

```typescript
const subscription = await stripe.subscriptions.retrieve(subId);
if (subscription.customer !== userStripeCustomerId) {
  throw new Error("Unauthorized");
}
```

### 2. Use Metadata for Tracking
Store useful context in Stripe metadata:

```typescript
subscription_metadata = {
  platform_user_id: userId,
  created_at: ISO8601,
  updated_by: userId,
  source: "web_app",
}
```

### 3. Handle Stripe Sync Delays
Subscriptions may take a few seconds to sync. Provide feedback:

```typescript
// After creating subscription
setTimeout(() => {
  // Refetch subscription to show updated status
  loadSubscription();
}, 2000);
```

### 4. Idempotent Operations
Edge Functions should be idempotent (safe to retry):

```typescript
// Create customer is idempotent
// Checks if user already has stripe_customer_id
const { data: user } = await supabase
  .from("public.users")
  .select("stripe_customer_id")
  .eq("id", userId);

if (user?.stripe_customer_id) {
  return { customer_id: user.stripe_customer_id };
}
```

### 5. Feature Flags in Metadata
Store all feature flags in Stripe Product metadata:

```json
{
  "limits_sites": "5",
  "feature_projects": "true",
  "feature_local_plugins": "false",
  "feature_local_themes": "true",
  "feature_team_invites": "true"
}
```

### 6. Never Trust Frontend for Permissions
Always verify subscription on the backend:

```typescript
// ❌ BAD - trusts frontend
async function createSite(data) {
  if (userCanCreateSites) { // Frontend said so
    // Create site
  }
}

// ✅ GOOD - verifies in backend
async function createSite(data) {
  const subscription = await getSubscriptionStatus(userId);
  const canCreate = subscription?.plan_features?.limits_sites > siteCount;
  if (!canCreate) {
    throw new Error("Subscription does not allow this");
  }
  // Create site
}
```

## Troubleshooting

### Subscription Not Syncing
1. Check `stripe_sync_log` table for errors
2. Verify webhook endpoint is configured in Stripe Dashboard
3. Check webhook secret is correct in Edge Function env vars
4. Ensure webhook events are being sent (test in Stripe Dashboard)

### User Can Access Feature They Shouldn't
1. Check user's subscription status in `stripe.subscriptions`
2. Verify subscription is in 'active' status
3. Check product metadata has correct feature flags
4. Clear browser cache and refetch subscription

### Payment Method Not Saving
1. Verify payment method was created successfully on frontend
2. Check payment method is attached to customer in Stripe Dashboard
3. Ensure subscription update included the payment method ID
4. Check Stripe Account has payment methods enabled

### Plan Not Showing in Pricing Page
1. Verify plan `is_public = true` in `subscription_plans` table
2. Check both monthly and yearly prices exist in `stripe.prices`
3. Ensure prices have correct `unit_amount` in cents
4. Check `stripe.products` has `active = true`

## Security Considerations

✅ **Implemented**:
- JWT verification on all Edge Functions
- HTTPS/TLS for all Stripe communications
- Stripe Elements (not raw card handling)
- RLS policies on public tables
- Service Role key never exposed to frontend
- Metadata validation before Stripe API calls
- Webhook signature verification

⚠️ **Verify These**:
- [ ] CORS headers are restrictive (not `*`)
- [ ] Edge Functions have proper rate limiting
- [ ] Stripe Webhook endpoint uses HTTPS
- [ ] Service Role key is never committed to git
- [ ] Users can only access their own data (RLS)

## Monitoring & Analytics

Track these metrics in your analytics:

```sql
-- Active subscriptions by plan
SELECT plan_name, COUNT(*) as count
FROM user_subscriptions
WHERE is_active = true
GROUP BY plan_name;

-- Subscription funnel
SELECT 
  COUNT(DISTINCT user_id) as signed_up,
  COUNT(DISTINCT CASE WHEN stripe_customer_id IS NOT NULL THEN user_id END) as has_customer,
  COUNT(DISTINCT CASE WHEN subscription_id IS NOT NULL THEN user_id END) as has_subscription
FROM user_subscriptions;

-- Monthly Recurring Revenue
SELECT 
  plan_name,
  SUM(unit_amount::bigint) as mrr_cents
FROM user_subscriptions us
JOIN stripe.prices sp ON TRUE
WHERE us.is_active = true
AND sp.id = us.stripe_price_id
GROUP BY plan_name;

-- Churn
SELECT 
  COUNT(*) as canceled_subscriptions,
  AVG(EXTRACT(EPOCH FROM (canceled_at - created))/86400) as avg_days_until_cancel
FROM stripe.subscriptions
WHERE status = 'canceled'
AND canceled_at > NOW() - INTERVAL '30 days';
```

## Next Steps

1. **Deploy Database Migration** - Run SQL migration in Supabase
2. **Set Environment Variables** - Configure Stripe keys in Supabase
3. **Deploy Edge Functions** - Deploy all Edge Functions to Supabase
4. **Configure Webhooks** - Add webhook endpoint in Stripe Dashboard
5. **Test Registration Flow** - Verify user → Stripe Customer creation
6. **Test Subscription Creation** - Create test subscription
7. **Verify Sync** - Check data appears in stripe.* tables
8. **Deploy Frontend** - Deploy React components and hooks
9. **Load Test** - Test with concurrent users
10. **Monitor** - Watch sync logs and error rates

## Support & References

- [Stripe Documentation](https://stripe.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Stripe React Integration](https://stripe.com/docs/stripe-js/react)
