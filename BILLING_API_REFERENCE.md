# Billing Edge Functions API Reference

## Base URL
```
https://ossyxxlplvqakowiwbok.supabase.co/functions/v1
```

## Authentication
All endpoints require Bearer token in Authorization header:
```javascript
const token = supabase.auth.session().access_token;
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

---

## 🔵 USER ENDPOINTS

### 1. Create Stripe Customer
**Endpoint**: `POST /create-stripe-customer`  
**Purpose**: Create Stripe customer record for user (call on signup)  
**Body**: Empty  

```javascript
const { data, error } = await supabase.functions.invoke('create-stripe-customer', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
// Returns: { customer_id: "cus_...", email: "user@example.com" }
```

---

### 2. Create Subscription
**Endpoint**: `POST /create-subscription`  
**Purpose**: Create subscription with payment method  
**Body**:
```json
{
  "price_id": "price_...",
  "payment_method_id": "pm_...",
  "trial_days": 14
}
```

```javascript
const { data, error } = await supabase.functions.invoke('create-subscription', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: {
    price_id: 'price_1234567890',
    payment_method_id: 'pm_1234567890',
    trial_days: 14
  }
});
// Returns: { subscription_id: "sub_...", status: "trialing" }
```

---

### 3. Update Subscription
**Endpoint**: `POST /update-subscription`  
**Purpose**: Upgrade/downgrade to different plan  
**Body**:
```json
{
  "subscription_id": "sub_...",
  "new_price_id": "price_...",
  "proration_behavior": "create_prorations"
}
```

**Proration options:**
- `"create_prorations"` - Bill customer the difference (default)
- `"none"` - No prorations, just switch at period end
- `"always_invoice"` - Invoice for differences immediately

```javascript
const { data, error } = await supabase.functions.invoke('update-subscription', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: {
    subscription_id: 'sub_1234567890',
    new_price_id: 'price_2345678901',
    proration_behavior: 'create_prorations'
  }
});
// Returns: { subscription_id: "sub_...", status: "active" }
```

---

### 4. Cancel Subscription
**Endpoint**: `POST /cancel-subscription`  
**Purpose**: Cancel subscription (immediate or end of period)  
**Body**:
```json
{
  "subscription_id": "sub_...",
  "immediately": false
}
```

**Options:**
- `immediately: true` - Stop access now, return prorated credit
- `immediately: false` - Keep access until billing period ends (default)

```javascript
const { data, error } = await supabase.functions.invoke('cancel-subscription', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: {
    subscription_id: 'sub_1234567890',
    immediately: false
  }
});
// Returns: { subscription_id: "sub_...", status: "canceled", cancel_at_period_end: true }
```

---

### 5. Update Payment Method
**Endpoint**: `POST /update-payment-method`  
**Purpose**: Change default payment method  
**Body**:
```json
{
  "payment_method_id": "pm_...",
  "subscription_id": "sub_..."
}
```

```javascript
const { data, error } = await supabase.functions.invoke('update-payment-method', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: {
    payment_method_id: 'pm_1234567890',
    subscription_id: 'sub_1234567890'
  }
});
// Returns: { payment_method_id: "pm_...", attached: true }
```

---

### 6. Get Upcoming Invoice
**Endpoint**: `GET /upcoming-invoice`  
**Purpose**: Fetch user's next invoice details  
**Query Params**: None  

```javascript
const { data, error } = await supabase.functions.invoke('upcoming-invoice', {
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` }
});
// Returns: {
//   id: "in_...",
//   amount_due: 2999,  // in cents
//   currency: "usd",
//   next_payment_attempt: 1234567890,  // unix timestamp
//   lines: [...]
// }
```

---

## 🔴 ADMIN ENDPOINTS

### 7. Create Plan
**Endpoint**: `POST /admin-create-plan`  
**Purpose**: Create subscription plan in Stripe  
**Body**:
```json
{
  "name": "Pro Plan",
  "description": "For growing teams",
  "monthly_price_cents": 2999,
  "yearly_price_cents": 29990,
  "trial_days": 14,
  "features": {
    "sites": 10,
    "projects": 5,
    "api_calls": 100000,
    "custom_domain": true,
    "priority_support": false
  }
}
```

```javascript
const { data, error } = await supabase.functions.invoke('admin-create-plan', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: {
    name: 'Pro Plan',
    description: 'For growing teams',
    monthly_price_cents: 2999,
    yearly_price_cents: 29990,
    trial_days: 14,
    features: {
      sites: 10,
      projects: 5,
      api_calls: 100000,
      custom_domain: true,
      priority_support: false
    }
  }
});
// Returns: {
//   product_id: "prod_...",
//   monthly_price_id: "price_...",
//   yearly_price_id: "price_...",
//   plan_id: 123
// }
```

---

### 8. Update Plan
**Endpoint**: `POST /admin-update-plan`  
**Purpose**: Update plan name, description, pricing, or features  
**Body**:
```json
{
  "plan_id": 123,
  "name": "Pro Plus",
  "description": "For scaling teams",
  "monthly_price_cents": 3999,
  "yearly_price_cents": 39990,
  "features": {
    "sites": 20,
    "projects": 10,
    "api_calls": 500000,
    "custom_domain": true,
    "priority_support": true
  }
}
```

```javascript
const { data, error } = await supabase.functions.invoke('admin-update-plan', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: {
    plan_id: 123,
    name: 'Pro Plus',
    description: 'For scaling teams',
    monthly_price_cents: 3999,
    yearly_price_cents: 39990,
    features: {
      sites: 20,
      projects: 10,
      api_calls: 500000,
      custom_domain: true,
      priority_support: true
    }
  }
});
// Returns: { plan_id: 123, updated: true, new_monthly_price_id: "price_..." }
```

---

## 📊 Database Queries

### Get User's Current Subscription
```sql
SELECT * FROM user_subscriptions
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;
```

### Get All Active Subscriptions
```sql
SELECT * FROM active_subscriptions
WHERE created_at > NOW() - INTERVAL '30 days';
```

### Get Plan Features
```sql
SELECT metadata->>'sites' as sites,
       metadata->>'projects' as projects,
       metadata->>'custom_domain' as has_custom_domain
FROM stripe.products
WHERE id = 'prod_...';
```

### Get Sync Log (for debugging)
```sql
SELECT * FROM public.stripe_sync_log
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## 🧪 Test Examples

### Full Signup to Subscription Flow

```javascript
import { createClient } from '@supabase/supabase-js';
import { loadStripe } from '@stripe/stripe-js';

const supabase = createClient(url, key);
const stripe = await loadStripe(publicKey);

// 1. User signs up
const { user } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
});

// 2. Create Stripe customer
const { data: customer } = await supabase.functions.invoke('create-stripe-customer', {
  headers: { Authorization: `Bearer ${user.session.access_token}` }
});

// 3. Create payment method
const { paymentMethod } = await stripe.createPaymentMethod({
  type: 'card',
  card: cardElement,
  billing_details: { email: 'user@example.com' }
});

// 4. Create subscription
const { data: subscription } = await supabase.functions.invoke('create-subscription', {
  method: 'POST',
  headers: { Authorization: `Bearer ${user.session.access_token}` },
  body: {
    price_id: 'price_1234567890',
    payment_method_id: paymentMethod.id,
    trial_days: 14
  }
});

console.log('Subscription created:', subscription.subscription_id);
```

### Upgrade Plan Example

```javascript
// Get current subscription
const { data: { subscription } } = await supabase
  .from('user_subscriptions')
  .select('stripe_subscription_id')
  .single();

// Upgrade to new price
const { data } = await supabase.functions.invoke('update-subscription', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: {
    subscription_id: subscription.stripe_subscription_id,
    new_price_id: 'price_higher_tier',
    proration_behavior: 'create_prorations'
  }
});
```

### Check Feature Access Example

```javascript
// From useSubscriptionFeatures.ts
import { useSubscriptionFeatures } from '@/hooks/useSubscriptionFeatures';

function MyComponent() {
  const { canCreateSite, remaining } = useCanCreateSite(currentSiteCount);
  
  if (!canCreateSite) {
    return <UpgradePrompt sitesRemaining={remaining} />;
  }
  
  return <CreateSiteForm />;
}
```

---

## 🔗 Response Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid parameters) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (not admin for admin endpoints) |
| 404 | Not found (subscription/plan doesn't exist) |
| 409 | Conflict (duplicate resource) |
| 500 | Server error (check Supabase logs) |

---

## 🚨 Error Handling

All endpoints return error structure:
```json
{
  "error": {
    "message": "Subscription not found",
    "code": "SUBSCRIPTION_NOT_FOUND",
    "details": {...}
  }
}
```

---

## ⚡ Rate Limits
- No built-in rate limiting (configure in Supabase if needed)
- Stripe has its own rate limits: 100 requests/second
- Consider implementing backoff for retries

---

## 🔐 Security Notes
- Always verify `token` is valid before calling functions
- Never expose `STRIPE_SECRET_KEY` in frontend code
- Edge Functions validate JWT internally
- All user-specific calls automatically scoped to authenticated user
- Admin functions require user to have `admin` role (configurable)

---

## 📝 Integration Example - React Component

```typescript
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useSubscriptionFeatures } from '@/hooks/useSubscriptionFeatures';

export function SubscriptionManager() {
  const { user, supabase } = useAuth();
  const { canCreateSite, sitesRemaining } = useCanCreateSite(0);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (priceId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.session.access_token}`
        },
        body: { price_id: priceId }
      });
      
      if (error) throw error;
      alert('Subscription created!');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p>Sites remaining: {sitesRemaining}</p>
      {!canCreateSite && (
        <button onClick={() => handleUpgrade('price_pro')}>
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
```

---

**API Version**: 1.0  
**Last Updated**: 2026-01-03  
**Status**: 🟢 All endpoints live and tested
