# Quick Integration Guide - Stripe Elements

## 🚀 Quick Start (Next 30 Minutes)

### Step 1: Run Database Migration

Run one of these commands:

**Via Dashboard (Recommended)**:
1. Open: https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/sql
2. Create new query and paste from: `supabase/migrations/20260103_stripe_elements_extended_subscriptions.sql`
3. Click "Run"

**Via CLI**:
```bash
cd /Volumes/Code045Disk/Projects/Applications/wphub
supabase db push
# Enter database password when prompted
```

### Step 2: Test One Function

Test the simplest function first - validate-coupon:

```bash
curl -X POST \
  https://ossyxxlplvqakowiwbok.supabase.co/functions/v1/validate-coupon \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"coupon_code": "TEST", "subscription_plan_id": 1}'
```

## 🔌 Integration Points (Next 2 Hours)

### 1. Add PaymentElement to Checkout

**File**: `src/pages/Checkout.jsx`

```jsx
import { PaymentElementForm } from '../components/PaymentElement';
import { useValidateCoupon } from '../hooks/useStripeElements';

export default function Checkout() {
  const [couponCode, setCouponCode] = useState('');
  const validateCoupon = useValidateCoupon();

  const handleApplyCoupon = async () => {
    const result = await validateCoupon.mutateAsync({
      coupon_code: couponCode,
      subscription_plan_id: planId,
      amount: totalAmount
    });
    // Apply discount
  };

  return (
    <div>
      <input 
        value={couponCode}
        onChange={e => setCouponCode(e.target.value)}
        placeholder="Coupon code (optional)"
      />
      <button onClick={handleApplyCoupon}>Apply</button>
      
      <PaymentElementForm 
        planId={planId}
        amount={totalAmount}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
```

### 2. Add Pause/Resume to BillingAccount

**File**: `src/pages/BillingAccount.tsx`

```tsx
import { useSubscriptionPause } from '../hooks/useStripeElements';

export default function BillingAccount() {
  const pauseSubscription = useSubscriptionPause();
  const { data: subscription } = useUserSubscription();

  const handlePause = async () => {
    await pauseSubscription.mutateAsync({
      action: 'pause',
      pause_reason: 'User requested pause'
    });
  };

  const handleResume = async () => {
    await pauseSubscription.mutateAsync({
      action: 'resume'
    });
  };

  return (
    <div>
      {subscription?.subscription_paused_at ? (
        <button onClick={handleResume}>Resume Subscription</button>
      ) : (
        <button onClick={handlePause}>Pause Subscription</button>
      )}
    </div>
  );
}
```

### 3. Add Coupon Management to FinanceSettings

**File**: `src/pages/FinanceSettings.jsx`

```jsx
import { useAdminCreateCoupon, usePaymentFailures } from '../hooks/useStripeElements';

export default function FinanceSettings() {
  const createCoupon = useAdminCreateCoupon();
  const [code, setCode] = useState('');
  const [discountValue, setDiscountValue] = useState('');

  const handleCreateCoupon = async () => {
    await createCoupon.mutateAsync({
      code: code.toUpperCase(),
      discount_type: 'percentage',
      discount_value: parseInt(discountValue),
      max_redemptions: 100,
      applies_to_plans: [1, 2, 3]
    });
  };

  return (
    <div>
      <h3>Create Promotional Code</h3>
      <input 
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="e.g., SUMMER20"
      />
      <input 
        value={discountValue}
        onChange={e => setDiscountValue(e.target.value)}
        type="number"
        placeholder="Discount %"
      />
      <button onClick={handleCreateCoupon}>Create Coupon</button>
    </div>
  );
}
```

## 📊 Admin Dashboard

The admin dashboard is ready at: `/AdminSubscriptionDashboard`

Features:
- ✅ Payment failure overview (4 key metrics)
- ✅ Manage failed payments table with dunning actions
- ✅ Churn analysis with monthly trends
- ✅ Real-time updates via React Query

## 🔐 Environment Variables

Verify all are set in `.env`:
```
VITE_SUPABASE_URL=https://ossyxxlplvqakowiwbok.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
STRIPE_API_KEY=sk_test_...
VITE_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (needed for webhooks)
```

## 🧪 Testing Scenarios

### Test Pause Subscription
1. User has active subscription
2. Click "Pause Subscription" button
3. Verify in Supabase: `subscription_paused_at` is set
4. Verify in Stripe Dashboard: subscription.pause_collection is active

### Test Coupon Validation
1. Create test coupon: Code=TEST20, Discount=20%, Max Uses=5
2. Add to checkout form
3. Validate coupon
4. Verify discount calculation is correct

### Test Failed Payment Recovery
1. Admin views AdminSubscriptionDashboard
2. See "Payment Failures" tab
3. Click "Retry" on a failed payment
4. Verify admin-manage-dunning function executes
5. Check payment_failures table for updated status

### Test Webhook Events
1. Go to Stripe Dashboard → Developers → Webhooks → Your Endpoint
2. Click "Send test webhook"
3. Select event type (e.g., `customer.subscription.updated`)
4. Click "Send test webhook"
5. Check Supabase: subscription_events table should have new record

## 🔍 Debugging

**Check if migration is applied**:
```sql
-- In Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%payment%';
```

Expected tables:
- subscription_events
- payment_failures
- coupons
- coupon_usage
- admin_subscription_settings

**Check function deployment status**:
```bash
supabase functions list | grep -E "pause|delete|coupon|dunning|webhook"
```

Should all show `ACTIVE` status.

**Check webhook signature verification**:
All webhook function logs should show successful signature verification.

## 📋 Checklist

- [ ] Database migration executed via Dashboard or CLI
- [ ] Tables verified in Supabase: Tables tab
- [ ] Coupon created in admin console
- [ ] PaymentElement integrated into Checkout
- [ ] Pause/Resume buttons added to BillingAccount
- [ ] AdminSubscriptionDashboard accessible at `/AdminSubscriptionDashboard`
- [ ] Webhook signing secret added to environment
- [ ] Webhooks configured in Stripe Dashboard
- [ ] Test webhook event sent successfully
- [ ] Subscription events appear in database
- [ ] Admin dunning actions work (retry, forgive, cancel)

## 💡 Pro Tips

1. **Use React Query Devtools** to inspect hook queries/mutations
2. **Check Supabase function logs** for detailed error messages
3. **Test with Stripe test keys** before switching to production
4. **Enable Stripe webhook retries** in Dashboard settings
5. **Monitor subscription_events table** for audit trail of changes

## 🆘 Common Issues

**"Column does not exist"**
- Migration not yet applied
- Run migration via Supabase Dashboard

**"401 Unauthorized"**
- JWT token missing or expired
- Check Authorization header format: `Bearer {token}`

**"Webhook signature verification failed"**
- Wrong STRIPE_WEBHOOK_SECRET
- Get correct secret from Stripe Dashboard → Webhooks

**"Payment Intent not found"**
- stripe.prices table not populated
- Sync Stripe data via admin-sync-stripe-customers function

---

**Ready to integrate?** Start with Step 1 above!
