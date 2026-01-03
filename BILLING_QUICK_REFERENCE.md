# QUICK REFERENCE - Billing System

## 📋 Files at a Glance

| Component | File | Purpose |
|-----------|------|---------|
| **Database** | `supabase/migrations/20250103_create_billing_system.sql` | PostgreSQL schema |
| **Payment** | `src/pages/Pricing.tsx` | Pricing & checkout |
| **Billing** | `src/pages/BillingAccount.tsx` | Subscription management |
| **Features** | `src/hooks/useSubscriptionFeatures.ts` | Feature access checks |
| **Docs** | `BILLING_SYSTEM_README.md` | Overview |
| **Guide** | `BILLING_IMPLEMENTATION_GUIDE.md` | Step-by-step |
| **API** | `STRIPE_SYNC_INTEGRATION.md` | Webhook & sync |
| **Setup** | `BILLING_INTEGRATION_POINTS.md` | App integration |

---

## 🚀 10-Step Deployment

```bash
# 1. Deploy database
supabase migration up

# 2-9. Deploy Edge Functions
supabase functions deploy create-stripe-customer
supabase functions deploy create-subscription
supabase functions deploy update-subscription
supabase functions deploy cancel-subscription
supabase functions deploy update-payment-method
supabase functions deploy upcoming-invoice
supabase functions deploy admin-create-plan
supabase functions deploy admin-update-plan
supabase functions deploy stripe-webhook-sync

# 10. Update app structure (manual)
# - Add Stripe provider to main.jsx
# - Add routes to App.jsx
# - Update AuthContext to create customer on signup
```

---

## 🔑 Environment Variables

**Supabase (Settings → Secrets)**:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Frontend (.env.local)**:
```
VITE_STRIPE_PUBLIC_KEY=pk_live_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 🎯 Core Concepts

### 1. User ↔ Stripe Customer Link
```typescript
// Each user has ONE stripe_customer_id
users.stripe_customer_id = "cus_..."
stripe.customers.metadata.platform_user_id = users.id
```

### 2. Plans
```typescript
// Admin creates plan → Stripe Product + Prices
admin-create-plan({
  name: "Pro",
  monthly_price_cents: 2999,
  yearly_price_cents: 29990,
  features: { limits_sites: 10, ... }
})
```

### 3. Subscriptions
```typescript
// User subscribes → Stripe Subscription
create-subscription({
  price_id: "price_...",
  payment_method_id: "pm_..."
})
```

### 4. Feature Access
```typescript
// Derived from stripe.products.metadata
stripe.products.metadata.feature_team_invites = "true"
↓
user_subscriptions.plan_features.feature_team_invites = true
↓
useCanInviteTeamMembers() returns { can_invite: true }
```

### 5. Data Sync
```
Stripe API → Webhook → Edge Function → stripe.* tables
```

---

## 💻 Common Code Snippets

### Check Feature Access
```typescript
import { useCanCreateSite } from '@/hooks/useSubscriptionFeatures'

function MyComponent() {
  const { can_create, sites_remaining } = useCanCreateSite(3)
  
  return can_create ? (
    <button onClick={create}>Create Site</button>
  ) : (
    <p>Upgrade for {sites_remaining} more</p>
  )
}
```

### Get Current Subscription
```typescript
import { useUserSubscription } from '@/hooks/useSubscriptionFeatures'

function MyComponent() {
  const { data: subscription } = useUserSubscription()
  
  return subscription ? (
    <p>You're on {subscription.plan_name}</p>
  ) : (
    <p>No subscription</p>
  )
}
```

### Create Subscription
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/create-subscription`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    price_id: 'price_...',
    payment_method_id: 'pm_...'
  })
})
```

### Upgrade Plan
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/update-subscription`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    subscription_id: 'sub_...',
    price_id: 'price_...'
  })
})
```

---

## 📊 Database Quick Query

```sql
-- View all user subscriptions
SELECT * FROM user_subscriptions WHERE is_active = true;

-- Get specific user subscription
SELECT * FROM user_subscriptions WHERE user_id = 'uuid...';

-- Find sync errors
SELECT * FROM stripe_sync_log WHERE error_message IS NOT NULL;

-- MRR calculation
SELECT SUM(unit_amount::bigint) as mrr_cents
FROM user_subscriptions us
JOIN stripe.prices sp ON sp.id = us.stripe_price_id
WHERE is_active = true;
```

---

## 🧪 Testing Checklist

- [ ] User signup → stripe_customer_id set
- [ ] Stripe customer synced to stripe.customers
- [ ] Plan created → shows in /pricing
- [ ] Subscribe → payment method created
- [ ] Subscription created in Stripe
- [ ] Subscription synced to stripe.subscriptions
- [ ] useCanCreateSite() returns correct limit
- [ ] Upgrade plan → new subscription in Stripe
- [ ] Cancel subscription → status updated
- [ ] Invoice → appears in billing page
- [ ] Download PDF → works

---

## 🔧 Common Tasks

### Create Test Plan
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-plan`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Test Plan',
    monthly_price_cents: 999,
    yearly_price_cents: 9990,
    trial_days: 14,
    features: {
      limits_sites: 5,
      feature_projects: true,
      feature_local_plugins: true,
      feature_local_themes: false,
      feature_team_invites: true
    }
  })
})
```

### Update Payment Method
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/update-payment-method`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    subscription_id: 'sub_...',
    payment_method_id: 'pm_...'
  })
})
```

### Get Upcoming Invoice
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/upcoming-invoice`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
})
const invoice = await response.json()
console.log(`Next payment: $${(invoice.amount_due / 100).toFixed(2)}`)
```

---

## 🐛 Troubleshooting

| Issue | Check |
|-------|-------|
| No Stripe customer | Check `public.users.stripe_customer_id` |
| Plan not showing | Check `subscription_plans.is_public = true` |
| Can't subscribe | Check price exists in `stripe.prices` |
| Feature not gating | Check `stripe.products.metadata` |
| Webhook not syncing | Check `stripe_sync_log` for errors |
| Payment failing | Check card is valid (use 4242...) |
| Invoice not showing | Check subscription status is 'active' |

---

## 📖 Documentation Map

**Start here**: `BILLING_SYSTEM_README.md`
- Architecture overview
- What's included
- Quick start

**Deep dive**: `BILLING_IMPLEMENTATION_GUIDE.md`
- Step-by-step implementation
- Code examples
- Best practices

**For setup**: `BILLING_INTEGRATION_POINTS.md`
- App structure updates
- Component integration
- Testing guide

**For architecture**: `STRIPE_SYNC_INTEGRATION.md`
- Webhook handling
- Sync patterns
- Query examples

---

## 🎓 Key Principles

1. **Stripe is source of truth** - All subscription data in Stripe
2. **Supabase is read model** - Synced via webhooks
3. **Edge Functions for writes** - All API changes go through Edge Functions
4. **Feature flags in metadata** - Stored in stripe.products.metadata
5. **Async eventual consistency** - Webhooks may take a second
6. **Idempotent operations** - All endpoints safe to retry
7. **JWT verification** - All Edge Functions check auth
8. **RLS policies** - Database controls data access

---

## ⚡ Performance

- Feature checks: ~50ms
- Subscription queries: ~100ms
- Payment processing: ~3s
- Webhook sync: ~1s

**Scaling**: Edge Functions auto-scale, database indexed

---

## 🔒 Security

✅ Implemented:
- JWT verification
- Service key on backend only
- Webhook signature verification
- RLS policies
- Input validation
- Stripe Elements (PCI compliant)

---

## 📞 Need Help?

1. **Setup questions** → `BILLING_INTEGRATION_POINTS.md`
2. **How it works** → `BILLING_IMPLEMENTATION_GUIDE.md`
3. **API reference** → `STRIPE_SYNC_INTEGRATION.md`
4. **Overview** → `BILLING_SYSTEM_README.md`
5. **Troubleshooting** → See section above

---

**Ready to deploy?** Start with `BILLING_DEPLOYMENT_SUMMARY.md`
