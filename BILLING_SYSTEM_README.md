# Subscription & Billing System - Complete Implementation

A production-ready, enterprise-grade billing system for SaaS platforms built with **Stripe**, **Supabase**, and **React**.

## 📋 What's Included

### 1. Database Schema (`supabase/migrations/20250103_create_billing_system.sql`)

**User & Admin Tables**:
- `public.users` - Extended with `stripe_customer_id` and subscription fields (linked to `auth.users`)
- `public.subscription_plans` - Admin-managed plan definitions

**Read-Only Stripe Sync Schema** (`stripe.*`):
- `stripe.customers` - Synced Stripe customers
- `stripe.products` - Synced subscription products
- `stripe.prices` - Synced product prices (monthly/yearly)
- `stripe.subscriptions` - Synced user subscriptions
- `stripe.invoices` - Synced billing invoices
- `stripe.payment_methods` - Synced payment methods

**Helper Tables**:
- `public.stripe_sync_log` - Webhook sync tracking
- Views: `user_subscriptions`, `active_subscriptions`
- Functions: `get_user_active_subscription()`, `get_plan_metadata()`

**Security**:
- Row-level security policies (RLS)
- Separate read/write permissions
- Admin-only access to sensitive tables

### 2. Stripe Sync Engine (`STRIPE_SYNC_INTEGRATION.md`)

**Webhook Handler Edge Function**:
- Listens to Stripe events
- Syncs customers, products, prices, subscriptions, invoices, payment methods
- Tracks sync operations in `stripe_sync_log`
- Handles webhook signature verification

**Architecture**:
```
Stripe Events → Webhook → Edge Function → Upsert stripe.* tables
```

**Key Features**:
- Idempotent syncing (safe retries)
- Comprehensive error logging
- JSONB metadata support
- Foreign key relationships

### 3. Edge Functions (Serverless Backend)

#### User-Facing Functions

**`create-stripe-customer`**
- Called on user registration
- Idempotent (checks if customer exists)
- Links Supabase user to Stripe customer
- Returns `customer_id`

**`create-subscription`**
- User subscribes to plan
- Accepts payment method ID (from Stripe Elements)
- Applies trial days from plan config
- Returns subscription details with period dates

**`update-subscription`**
- Upgrade or downgrade plan
- Handles proration (charge/credit difference)
- Validates subscription ownership
- Returns updated subscription

**`cancel-subscription`**
- Cancel at period end (default) or immediately
- Tracks cancellation metadata
- Returns updated subscription status

**`update-payment-method`**
- Change default payment method
- Attaches payment method to customer if needed
- Updates subscription's default method
- Returns updated subscription

**`upcoming-invoice`**
- Fetch next invoice for active subscription
- Returns amount due and payment date
- Shows line items for display

#### Admin Functions

**`admin-create-plan`**
- Create new subscription plan
- Creates Stripe Product with metadata
- Creates monthly and yearly prices
- Stores plan in `subscription_plans`
- Returns plan details

**`admin-update-plan`**
- Modify plan name, description, pricing
- Creates new prices (prices are immutable)
- Updates feature metadata
- Maintains plan history

### 4. Frontend Components & Hooks

#### Feature Gating Hook (`src/hooks/useSubscriptionFeatures.ts`)

**Hooks**:
- `useUserSubscription()` - Get current subscription
- `useCanCreateSite()` - Check site creation limit
- `useCanUseProjects()` - Check projects feature
- `useCanUploadLocalPlugins()` - Check plugins feature
- `useCanUploadLocalThemes()` - Check themes feature
- `useCanInviteTeamMembers()` - Check team invites
- `useUserFeatures()` - Get all features at once

**Standalone Functions**:
- `checkFeatureAccess(userId, featureKey)` - Backend feature checks
- `getSubscriptionStatus(userId)` - Get subscription details
- `canUserPerformAction(userId, action)` - Check with reason
- `withFeatureGating(Component, feature)` - HOC for wrapping

**Usage**:
```typescript
const { can_create, sites_remaining } = useCanCreateSite(currentCount);

if (can_create) {
  <CreateSiteButton />
} else {
  <UpgradePrompt />
}
```

#### Pricing Page (`src/pages/Pricing.tsx`)

**Features**:
- Display all public subscription plans
- Monthly/yearly billing period toggle
- Show user's current plan
- Stripe Elements payment form
- Secure checkout with payment method creation
- Plan comparison
- FAQ section

**Flow**:
1. User selects plan
2. Enters payment details (Stripe Elements)
3. Frontend creates Payment Method
4. Calls `create-subscription` Edge Function
5. Subscription created in Stripe
6. User redirected to billing page

#### Billing & Account Page (`src/pages/BillingAccount.tsx`)

**Tabs**:
- **Overview**: Current subscription, upcoming invoice, billing period
- **Invoices**: View, download, and manage past invoices
- **Payment Method**: Save and manage payment methods

**Actions**:
- Upgrade/downgrade plan
- Cancel subscription at period end
- Update default payment method
- Download invoice PDFs
- View upcoming invoice with amount due

## 🏗️ Architecture

### Data Flow

```
┌─────────────────────────────────────────┐
│          React Frontend                  │
│  ├─ /pricing (Pricing page)             │
│  ├─ /account/billing (Billing page)     │
│  ├─ useSubscriptionFeatures (Hooks)     │
│  └─ Feature gating (withFeatureGating)  │
└──────────────────┬──────────────────────┘
                   │
                   │ HTTP / JWT
                   ▼
      ┌────────────────────────┐
      │   Edge Functions       │
      │ ├─ create-*            │
      │ ├─ update-*            │
      │ ├─ cancel-*            │
      │ ├─ admin-*             │
      │ └─ upcoming-invoice    │
      └──────────┬─────────────┘
                 │
                 │ Stripe API
                 │ (Service Key)
                 ▼
      ┌────────────────────────┐
      │    Stripe API          │
      │ (Source of Truth)      │
      │ ├─ Customers           │
      │ ├─ Products & Prices   │
      │ ├─ Subscriptions       │
      │ ├─ Invoices            │
      │ └─ Payment Methods     │
      └──────────┬─────────────┘
                 │
                 │ Webhooks
                 │
                 ▼
      ┌────────────────────────┐
      │  Webhook Handler       │
      │  Edge Function         │
      └──────────┬─────────────┘
                 │
                 │ Upsert
                 │
                 ▼
      ┌────────────────────────┐
      │    Supabase DB         │
      │                        │
      │ public.*               │
      │ ├─ users               │
      │ ├─ subscription_plans  │
      │ └─ stripe_sync_log     │
      │                        │
      │ stripe.* (read-only)   │
      │ ├─ customers           │
      │ ├─ products            │
      │ ├─ prices              │
      │ ├─ subscriptions       │
      │ ├─ invoices            │
      │ └─ payment_methods     │
      └────────────────────────┘
```

### Key Design Principles

1. **Stripe is the source of truth**
   - All subscription data in Stripe
   - Supabase is a read model
   - No business logic in synced tables

2. **Async sync via webhooks**
   - Stripe → Webhook → Edge Function → Supabase
   - Eventually consistent
   - Handles offline scenarios

3. **Write actions through Edge Functions**
   - No direct Stripe API calls from frontend
   - Server-side secret key usage
   - JWT verification on all endpoints

4. **Feature access from metadata**
   - Stored in `stripe.products.metadata`
   - Read from synced tables
   - Never computed on frontend

5. **Idempotent operations**
   - Safe to retry all endpoints
   - No duplicate subscriptions
   - Proper error handling

## 🚀 Quick Start

### 1. Deploy Database

```bash
# Run migration in Supabase
supabase migration up
```

### 2. Add Environment Variables

**Supabase (Edge Functions)**:
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Frontend (.env.local)**:
```env
VITE_STRIPE_PUBLIC_KEY=pk_live_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy create-stripe-customer
supabase functions deploy create-subscription
supabase functions deploy update-subscription
supabase functions deploy cancel-subscription
supabase functions deploy update-payment-method
supabase functions deploy upcoming-invoice
supabase functions deploy admin-create-plan
supabase functions deploy admin-update-plan
```

### 4. Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.functions.supabase.co/stripe-webhook-sync`
3. Select events:
   - `customer.created`, `customer.updated`, `customer.deleted`
   - `product.created`, `product.updated`, `product.deleted`
   - `price.created`, `price.updated`, `price.deleted`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.created`, `invoice.updated`
   - `payment_method.attached`, `payment_method.detached`, `payment_method.updated`

4. Copy webhook secret to Supabase

### 5. Create Plans (Admin)

```typescript
// Call admin-create-plan Edge Function
const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-plan`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    name: "Pro",
    monthly_price_cents: 2999,
    yearly_price_cents: 29990,
    trial_days: 14,
    features: {
      limits_sites: 10,
      feature_projects: true,
      feature_local_plugins: true,
      feature_local_themes: true,
      feature_team_invites: true,
    },
  }),
});
```

### 6. Add Routes & Components

```typescript
// In your router
import Pricing from "@/pages/Pricing";
import BillingAccount from "@/pages/BillingAccount";

// Add routes
<Route path="/pricing" element={<Pricing />} />
<Route path="/account/billing" element={<BillingAccount />} />
```

### 7. Use Feature Gating

```typescript
import { useCanInviteTeamMembers } from "@/hooks/useSubscriptionFeatures";

function InviteTeamButton() {
  const { can_invite } = useCanInviteTeamMembers();

  if (!can_invite) {
    return <UpgradePlan />;
  }

  return <button onClick={invite}>Invite Team Member</button>;
}
```

## 📊 Database Schema Quick Reference

### subscription_plans
```
id, stripe_product_id, stripe_price_monthly_id, stripe_price_yearly_id,
name, description, position, is_public, monthly_price_cents,
yearly_price_cents, trial_days
```

### stripe.customers
```
id (PK), email, metadata, default_source, delinquent
```

### stripe.subscriptions
```
id (PK), customer_id (FK), status, current_period_start, current_period_end,
cancel_at_period_end, trial_end, items (JSON), metadata
```

### stripe.invoices
```
id (PK), customer_id (FK), subscription_id (FK), status, amount_due,
amount_paid, pdf, hosted_invoice_url
```

## 🔐 Security

✅ **Implemented**:
- JWT verification on all Edge Functions
- Service Role key usage for Stripe API
- Stripe Elements (PCI-compliant)
- Webhook signature verification
- RLS policies on public tables
- Metadata validation

⚠️ **To Verify**:
- CORS headers are restrictive
- Rate limiting on Edge Functions
- Webhook endpoint uses HTTPS
- Service keys not in version control
- Stripe webhook secret is secure

## 📝 API Reference

### create-subscription

```typescript
POST /functions/v1/create-subscription
Headers: Authorization: Bearer <JWT>

Request:
{
  price_id: string,
  payment_method_id?: string,
  metadata?: Record<string, string>
}

Response:
{
  subscription_id: string,
  status: string,
  current_period_start: number,
  current_period_end: number,
  trial_end: number | null
}
```

### update-subscription

```typescript
POST /functions/v1/update-subscription
Headers: Authorization: Bearer <JWT>

Request:
{
  subscription_id: string,
  price_id: string,
  proration_behavior?: "create_invoices" | "always_invoice" | "none"
}

Response:
{
  subscription_id: string,
  status: string,
  current_period_start: number,
  current_period_end: number
}
```

### cancel-subscription

```typescript
POST /functions/v1/cancel-subscription
Headers: Authorization: Bearer <JWT>

Request:
{
  subscription_id: string,
  cancel_immediately?: boolean
}

Response:
{
  subscription_id: string,
  status: string,
  canceled_at: number,
  cancel_at: number,
  cancel_at_period_end: boolean
}
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Create Stripe test account
- [ ] User signup → Stripe customer created
- [ ] Subscribe to plan → Subscription in Stripe
- [ ] Payment details saved → Payment method synced
- [ ] Upgrade plan → New subscription in Stripe
- [ ] Cancel subscription → Marked as canceled
- [ ] Feature check → Returns correct access
- [ ] Invoice download → PDF URL works
- [ ] Webhook → Data syncs to Supabase

### Integration Tests

```typescript
// Test subscription creation
test("creates subscription with payment method", async () => {
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });

  const response = await createSubscription({
    priceId: "price_...",
    paymentMethodId: paymentMethod.id,
  });

  expect(response.subscription_id).toBeDefined();
  expect(response.status).toBe("active");
});
```

## 📚 Documentation Files

- **`BILLING_IMPLEMENTATION_GUIDE.md`** - Complete implementation guide with examples
- **`STRIPE_SYNC_INTEGRATION.md`** - Stripe Sync Engine architecture and patterns
- **`supabase/migrations/20250103_create_billing_system.sql`** - Database schema with comments

## 🆘 Troubleshooting

### Subscription not appearing after creation
1. Check `stripe_sync_log` for errors
2. Verify webhook endpoint is active in Stripe Dashboard
3. Test webhook manually in Stripe Dashboard
4. Check `stripe.subscriptions` table

### Feature access returning wrong value
1. Verify `stripe.products.metadata` has correct flags
2. Check user's subscription status in `stripe.subscriptions`
3. Ensure `current_period_end` is in future
4. Clear browser cache and refetch

### Payment method not saving
1. Check payment method was created successfully
2. Verify it appears in `stripe.payment_methods`
3. Ensure it's attached to correct customer
4. Check Edge Function logs for errors

## 📦 Dependencies

- `@stripe/js` - Stripe JavaScript library
- `@stripe/react-stripe-js` - React Stripe integration
- `@tanstack/react-query` - Data fetching and caching
- `@supabase/supabase-js` - Supabase client

## 📄 License

MIT

## 🤝 Support

For questions or issues:
1. Check documentation files
2. Review Edge Function logs in Supabase
3. Check Stripe Dashboard for webhook failures
4. Check `stripe_sync_log` table for sync errors

---

**Built with ❤️ for modern SaaS platforms**
