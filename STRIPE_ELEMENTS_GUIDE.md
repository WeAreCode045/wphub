# Stripe Elements & Complete Subscription Management System

Complete implementation guide for Stripe Elements integration with advanced subscription management features for wphub platform.

## Overview

This implementation extends the existing Stripe-based billing system with:
- **Stripe Elements** for flexible, multi-method payment collection
- **Pause/Resume Subscriptions** for user flexibility
- **Real-time Webhook Syncing** for subscription event tracking
- **Dunning Management** for failed payment recovery
- **Coupon/Discount System** for promotional campaigns
- **Admin Dashboard** with analytics and churn analysis
- **Payment Method Management** including deletion

## Architecture

### Frontend Components

#### 1. PaymentElement Component
**File:** `src/components/PaymentElement.jsx`

Multi-method payment form using Stripe Elements with automatic payment method selection.

**Supported Payment Methods:**
- Credit/Debit Cards (Visa, Mastercard, American Express, Discover)
- Apple Pay
- Google Pay
- PayPal
- Bank Transfers (SEPA, etc.)
- Link (Stripe's saved payment network)

**Usage:**
```jsx
import PaymentElementForm from "@/components/PaymentElement";

<PaymentElementForm
  priceId="price_xxxxx"
  mode="subscription"
  onSuccess={(paymentIntent) => console.log("Success", paymentIntent)}
  onError={(error) => console.log("Error", error)}
/>
```

**Key Features:**
- Automatic payment method detection
- Client secret generation on demand
- Error handling and user feedback
- Loading states
- PCI compliance

#### 2. BillingAddressElement Component
**File:** `src/components/BillingAddressElement.jsx`

Collects complete billing address with autocomplete support.

**Usage:**
```jsx
import BillingAddressElement from "@/components/BillingAddressElement";

<BillingAddressElement onChange={(address) => handleAddressChange(address)} />
```

#### 3. FastCheckoutElement Component
**File:** `src/components/FastCheckoutElement.jsx`

Enables faster checkout by auto-filling payment and address details via Stripe Link.

**Usage:**
```jsx
import FastCheckoutElement from "@/components/FastCheckoutElement";

<FastCheckoutElement onEmailChange={(email) => handleEmail(email)} />
```

### Backend Edge Functions

#### 1. create-payment-intent-subscription
**Path:** `supabase/functions/create-payment-intent-subscription/index.ts`

Creates Payment Intent for subscription purchases using Stripe Elements.

**Endpoint:** `POST /functions/v1/create-payment-intent-subscription`

**Request:**
```json
{
  "price_id": "price_xxxxx",
  "metadata": {
    "custom_key": "value"
  }
}
```

**Response:**
```json
{
  "client_secret": "pi_xxxxx_secret_xxxxx",
  "payment_intent_id": "pi_xxxxx",
  "amount": 9900,
  "currency": "eur"
}
```

#### 2. create-payment-intent
**Path:** `supabase/functions/create-payment-intent/index.ts`

Creates Payment Intent for one-time payments.

**Endpoint:** `POST /functions/v1/create-payment-intent`

**Request:**
```json
{
  "amount": 9900,
  "currency": "eur",
  "description": "One-time payment"
}
```

#### 3. pause-subscription
**Path:** `supabase/functions/pause-subscription/index.ts`

Pause or resume an active subscription.

**Endpoint:** `POST /functions/v1/pause-subscription`

**Request:**
```json
{
  "action": "pause|resume",
  "pause_reason": "Optional reason"
}
```

**Response:**
```json
{
  "success": true,
  "action": "pause|resume",
  "subscription_id": "sub_xxxxx",
  "paused_at": "2026-01-03T10:00:00Z"
}
```

#### 4. delete-payment-method
**Path:** `supabase/functions/delete-payment-method/index.ts`

Delete a saved payment method.

**Endpoint:** `POST /functions/v1/delete-payment-method`

**Request:**
```json
{
  "payment_method_id": "pm_xxxxx"
}
```

**Constraints:**
- Cannot delete default payment method of active subscription
- Returns 400 error if attempting to delete default method

#### 5. webhook-stripe-sync
**Path:** `supabase/functions/webhook-stripe-sync/index.ts`

Handles real-time Stripe webhook events for subscription and payment updates.

**Setup:** Configure webhook in Stripe Dashboard to point to:
```
https://[PROJECT_ID].supabase.co/functions/v1/webhook-stripe-sync
```

**Webhook Events Handled:**
- `customer.subscription.updated` - Sync subscription changes
- `customer.subscription.deleted` - Track cancellations
- `invoice.payment_failed` - Log payment failures
- `invoice.payment_succeeded` - Mark failures as resolved
- `payment_intent.succeeded` - Track one-time payments
- `payment_intent.payment_failed` - Log payment failures
- `charge.refunded` - Track refunds

**Database Sync:**
- Updates `stripe.subscriptions` table
- Creates entries in `subscription_events` table
- Logs payment failures in `payment_failures` table

#### 6. admin-manage-dunning
**Path:** `supabase/functions/admin-manage-dunning/index.ts`

Manage failed payments through dunning workflow.

**Endpoint:** `POST /functions/v1/admin-manage-dunning`

**Request:**
```json
{
  "action": "retry|forgive|cancel|notify",
  "payment_failure_id": "xxxxx",
  "note": "Optional admin note"
}
```

**Actions:**
- **retry**: Attempt payment collection again
- **forgive**: Mark failure as forgiven (no further action)
- **cancel**: Cancel associated subscription
- **notify**: Send customer notification

#### 7. admin-create-coupon
**Path:** `supabase/functions/admin-create-coupon/index.ts`

Create promotional coupon codes.

**Endpoint:** `POST /functions/v1/admin-create-coupon`

**Request:**
```json
{
  "code": "SUMMER50",
  "type": "percentage|fixed_amount",
  "amount": 50,
  "currency": "eur",
  "max_redemptions": 100,
  "valid_until": "2026-12-31",
  "applies_to_plans": ["plan_id_1", "plan_id_2"],
  "minimum_amount": 2900,
  "applies_once": true,
  "description": "Summer promotion"
}
```

**Response:**
```json
{
  "success": true,
  "coupon": {
    "id": 123,
    "code": "SUMMER50",
    "stripe_coupon_id": "SUMMER50",
    "created_at": "2026-01-03T10:00:00Z"
  }
}
```

#### 8. validate-coupon
**Path:** `supabase/functions/validate-coupon/index.ts`

Validate coupon code before purchase.

**Endpoint:** `POST /functions/v1/validate-coupon`

**Request:**
```json
{
  "code": "SUMMER50",
  "subscription_id": "sub_xxxxx",
  "amount": 9900
}
```

**Response:**
```json
{
  "valid": true,
  "coupon": {
    "id": 123,
    "code": "SUMMER50",
    "type": "percentage",
    "amount": 50
  },
  "discount": {
    "amount": 4950,
    "type": "percentage",
    "percentage": 50
  }
}
```

**Validation Checks:**
- Coupon exists and is active
- Not expired
- Has remaining redemptions
- User meets all requirements
- Minimum order amount met

### Hooks

**File:** `src/hooks/useStripeElements.ts`

Provides React hooks for subscription management:

```jsx
// Pause/resume subscription
const { mutate: pauseSubscription } = useSubscriptionPause();
pauseSubscription({ action: "pause", pause_reason: "Need a break" });

// Delete payment method
const { mutate: deleteMethod } = useDeletePaymentMethod();
deleteMethod("pm_xxxxx");

// Validate coupon
const { mutate: validateCoupon } = useValidateCoupon();
validateCoupon({ code: "SUMMER50", amount: 9900 });

// Get subscription events
const { data: events } = useSubscriptionEvents("sub_xxxxx");

// Manage payment failures (admin)
const { mutate: manageDunning } = useAdminManageDunning();
manageDunning({ action: "retry", payment_failure_id: 123 });

// Get payment statistics (admin)
const { data: stats } = usePaymentFailureStats();
const { data: churn } = useChurnAnalysis();
```

### Admin Components

#### AdminSubscriptionDashboard
**File:** `src/pages/AdminSubscriptionDashboard.jsx`

Comprehensive admin dashboard with:
- **Overview Tab**: Key metrics and charts
- **Payment Failures Tab**: Failed payment management with dunning actions
- **Churn Analysis Tab**: Subscription cancellation trends

**Metrics:**
- Pending payment failures count
- Total failure amount
- Average retries
- Payment success rate

## Database Schema

### New Tables

#### subscription_events
Tracks all subscription lifecycle events.

```sql
CREATE TABLE subscription_events (
  id BIGSERIAL PRIMARY KEY,
  subscription_id TEXT,
  event_type TEXT,        -- subscription_updated, invoice_paid, etc.
  previous_status TEXT,
  new_status TEXT,
  event_data JSONB,
  created_at TIMESTAMP
);
```

#### payment_failures
Tracks failed payments for dunning workflow.

```sql
CREATE TABLE payment_failures (
  id BIGSERIAL PRIMARY KEY,
  invoice_id TEXT UNIQUE,
  subscription_id TEXT,
  customer_id TEXT,
  amount BIGINT,
  currency TEXT,
  failure_code TEXT,
  failure_message TEXT,
  status TEXT,            -- pending, retrying, resolved, etc.
  retry_count INTEGER,
  resolved_at TIMESTAMP
);
```

#### coupons
Promotional discount codes.

```sql
CREATE TABLE coupons (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  stripe_coupon_id TEXT,
  type TEXT,              -- fixed_amount, percentage
  amount BIGINT,
  valid_until TIMESTAMP,
  max_redemptions INTEGER,
  applies_to_plans TEXT[],
  created_by TEXT
);
```

#### coupon_usage
Track coupon redemptions.

```sql
CREATE TABLE coupon_usage (
  id BIGSERIAL PRIMARY KEY,
  coupon_id BIGINT,
  user_id TEXT,
  subscription_id TEXT,
  used_at TIMESTAMP
);
```

### New Columns

Added to `public.users`:
- `subscription_paused_at TIMESTAMP` - When subscription was paused
- `pause_reason TEXT` - Reason for pause
- `pausable_until TIMESTAMP` - Max pause duration

### Views

#### payment_failure_stats
Daily payment failure statistics.

#### subscription_churn_analysis
Monthly churn analysis with cancellation and renewal counts.

## Setup Instructions

### 1. Environment Variables

Ensure your `.env` has:
```
STRIPE_SECRET_KEY=sk_test_xxxxx
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # For webhook verification
VITE_SUPABASE_URL=https://xxxxx.supabase.co
```

### 2. Stripe Setup

1. Create webhook endpoint in Stripe Dashboard:
   - Go to Developers → Webhooks
   - Add endpoint: `https://[PROJECT].supabase.co/functions/v1/webhook-stripe-sync`
   - Subscribe to events:
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`

2. Get webhook signing secret and add to environment as `STRIPE_WEBHOOK_SECRET`

### 3. Database Migration

Run the migration:
```bash
supabase migration up
```

This creates all new tables, columns, and views.

### 4. Deploy Functions

Deploy all edge functions:
```bash
supabase functions deploy pause-subscription
supabase functions deploy delete-payment-method
supabase functions deploy create-payment-intent
supabase functions deploy create-payment-intent-subscription
supabase functions deploy webhook-stripe-sync
supabase functions deploy admin-manage-dunning
supabase functions deploy admin-create-coupon
supabase functions deploy validate-coupon
```

## Usage Examples

### User Subscription Management

```jsx
// Pause subscription
const { mutate: pauseSubscription } = useSubscriptionPause();
pauseSubscription({
  action: "pause",
  pause_reason: "Temporary break needed"
});

// Resume subscription
pauseSubscription({
  action: "resume"
});

// Delete payment method
const { mutate: deleteMethod } = useDeletePaymentMethod();
deleteMethod("pm_xxxxx");

// Use coupon at checkout
const { mutate: validateCoupon, data: discount } = useValidateCoupon();
validateCoupon({ code: "SUMMER50" });
```

### Admin Operations

```jsx
// Create coupon
const { mutate: createCoupon } = useAdminCreateCoupon();
createCoupon({
  code: "SUMMER50",
  type: "percentage",
  amount: 50,
  max_redemptions: 100
});

// Manage failed payments
const { mutate: manageDunning } = useAdminManageDunning();
manageDunning({
  action: "retry",
  payment_failure_id: 123
});

// Access dashboard
import AdminSubscriptionDashboard from "@/pages/AdminSubscriptionDashboard";

<AdminSubscriptionDashboard />
```

## Security Considerations

1. **PCI Compliance**: Payment data handled entirely by Stripe Elements
2. **Webhook Verification**: All webhooks verified using Stripe signing secret
3. **Authentication**: All endpoints require valid JWT token
4. **Authorization**: Admin actions require admin role
5. **Data Isolation**: Row-level security policies prevent cross-user data access
6. **Rate Limiting**: Implement rate limiting on admin endpoints (future)

## Testing

### Test Cards

| Scenario | Card | Result |
|----------|------|--------|
| Success | 4242424242424242 | ✅ Payment succeeds |
| Requires Auth | 4000002500003155 | 🔐 3D Secure needed |
| Declined | 4000000000009995 | ❌ Declined |
| Expired | 4000000000000069 | ❌ Expired card |

### Test Webhook Events

Trigger test events from Stripe Dashboard:
- Go to Developers → Webhooks → Select endpoint
- Click "Send test event"
- Monitor functions logs in Supabase

## Monitoring

### View Function Logs

```bash
supabase functions logs webhook-stripe-sync
supabase functions logs pause-subscription
supabase functions logs admin-manage-dunning
```

### Monitor Payment Failures

Query in Supabase Dashboard:
```sql
SELECT * FROM public.payment_failures 
WHERE status = 'pending' 
ORDER BY created_at DESC;
```

### Check Webhook Sync

```sql
SELECT * FROM public.subscription_events 
WHERE event_type IN ('invoice_paid', 'payment_failed') 
ORDER BY created_at DESC LIMIT 50;
```

## Performance Optimization

### Indexes
All critical tables have indexes on:
- Subscription ID
- Customer ID
- Status fields
- Created date

### Views
Pre-calculated statistics views:
- `payment_failure_stats` - Daily aggregation
- `subscription_churn_analysis` - Monthly aggregation

## Error Handling

### Common Errors

**"User does not have a Stripe customer account"**
- Solution: Ensure user created via `create-stripe-customer` endpoint first

**"Webhook signature verification failed"**
- Solution: Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard

**"Cannot delete default payment method"**
- Solution: Set another payment method as default first

**"Coupon has expired"**
- Solution: Check coupon `valid_until` date in database

## Future Enhancements

1. **Proration Customization** - Allow custom proration rules per plan
2. **Subscription Pause Duration** - Set maximum pause periods
3. **Advanced Dunning** - ML-powered retry scheduling
4. **Multi-Subscription** - Support multiple simultaneous subscriptions
5. **Tax Calculation** - Integrate Stripe Tax API
6. **Invoice Customization** - White-label invoice templates
7. **Refund Automation** - Automatic refund workflows
8. **Subscription Tiers** - Dynamic plan switching

## Support & Troubleshooting

See comprehensive guides:
- [STRIPE_CHECKOUT_INTEGRATION.md](./STRIPE_CHECKOUT_INTEGRATION.md) - Checkout-specific details
- Edge function logs in Supabase Dashboard
- Stripe API logs in Stripe Dashboard
- Browser console for client-side errors

---

**Status:** ✅ Production Ready (as of January 3, 2026)
**Last Updated:** January 3, 2026
