# Stripe Payment Configuration Feature

## Overview
Added the ability to configure which payment methods are available during checkout by setting a Stripe Payment Configuration ID in the admin panel.

## Changes Made

### 1. Finance Settings Page (FinanceSettings.jsx)

**New Field in Stripe Settings Tab:**
- Payment Configuration ID input field
- Save button with loading state
- Current configuration display
- Link to Stripe Dashboard payment configurations

**State Management:**
```javascript
const [paymentConfiguration, setPaymentConfiguration] = useState("");
```

**Save Mutation:**
```javascript
const savePaymentConfigurationMutation = useMutation({
  mutationFn: async (configId) => {
    // Saves to site_settings table with key 'stripe_payment_configuration'
  }
});
```

### 2. Checkout Session Edge Function (create-checkout-session/index.ts)

**Fetches Payment Configuration:**
```typescript
const { data: paymentConfigSetting } = await supabase
  .from('site_settings')
  .select('setting_value')
  .eq('setting_key', 'stripe_payment_configuration')
  .single();

const paymentConfiguration = paymentConfigSetting?.setting_value || null;
```

**Applies to Checkout Session:**
```typescript
if (paymentConfiguration) {
  sessionParams.payment_method_configuration = paymentConfiguration;
}
```

### 3. Database Migration (20260103_add_stripe_payment_configuration.sql)

**Adds Setting Entry:**
```sql
INSERT INTO public.site_settings (setting_key, setting_value, description)
VALUES (
  'stripe_payment_configuration',
  '',
  'Stripe Payment Configuration ID for controlling available payment methods'
)
ON CONFLICT (setting_key) DO NOTHING;
```

## How It Works

### Admin Setup
1. **Navigate to Finance Settings** → Stripe Instellingen tab
2. **Find "Payment Configuration ID"** field
3. **Enter Stripe Payment Configuration ID** (e.g., `pmc_1AbCdEfGhIjKlMnO`)
   - Get this from: https://dashboard.stripe.com/settings/payment_method_configurations
4. **Click "Save Payment Configuration"**
5. Configuration is stored in `site_settings` table

### Checkout Flow
1. User selects a plan and proceeds to checkout
2. `create-checkout-session` edge function is called
3. Function fetches payment configuration from `site_settings`
4. If configuration exists, it's added to Stripe checkout session
5. Stripe displays only the payment methods defined in that configuration

## Payment Configuration Benefits

### 🎯 Control Payment Methods
- Enable/disable specific payment methods (cards, Apple Pay, Google Pay, iDEAL, etc.)
- Different configs for different regions
- Test vs Production configurations

### 🌍 Regional Customization
- Show iDEAL for Netherlands
- Show SEPA for EU
- Show ACH for USA
- Show Boleto for Brazil

### 💳 Brand Control
- Only allow specific card brands (Visa, Mastercard)
- Disable expensive payment methods
- Enable bank transfers for large amounts

### 🧪 Testing
- Use test configuration during development
- Switch to production configuration for live payments
- A/B test different payment method combinations

## Stripe Payment Configuration Setup

### Creating a Payment Configuration in Stripe

1. **Go to Stripe Dashboard**
   - Navigate to: https://dashboard.stripe.com/settings/payment_method_configurations

2. **Create Configuration**
   - Click "New configuration"
   - Name it (e.g., "EU Checkout", "US Checkout", "Test Config")

3. **Select Payment Methods**
   - ✅ Cards (Visa, Mastercard, Amex, etc.)
   - ✅ Apple Pay / Google Pay
   - ✅ iDEAL (Netherlands)
   - ✅ SEPA Direct Debit (EU)
   - ✅ Bancontact (Belgium)
   - ✅ Giropay (Germany)
   - ✅ PayPal
   - And many more...

4. **Save Configuration**
   - Copy the Configuration ID (starts with `pmc_`)
   - Paste it in Finance Settings

### Example Configurations

**EU Standard:**
```
ID: pmc_1AbCdEfGhIjKlMnO
Methods: Cards, Apple Pay, Google Pay, iDEAL, SEPA, Bancontact
```

**US Standard:**
```
ID: pmc_2BcDeFgHiJkLmNoP
Methods: Cards, Apple Pay, Google Pay, ACH Direct Debit
```

**Cards Only:**
```
ID: pmc_3CdEfGhIjKlMnOpQ
Methods: Cards (all brands)
```

## Testing

### Prerequisites
- Admin access to Finance Settings
- Stripe Dashboard access
- Test mode payment configuration created

### Test Steps

1. **Set Payment Configuration**
   ```
   - Go to Finance Settings > Stripe Instellingen
   - Enter test configuration ID: pmc_test_xxxxxxxxxxxxx
   - Save
   ```

2. **Verify Database**
   ```sql
   SELECT setting_value 
   FROM site_settings 
   WHERE setting_key = 'stripe_payment_configuration';
   ```

3. **Test Checkout**
   ```
   - Navigate to Checkout page
   - Select a plan
   - Verify only configured payment methods appear
   ```

4. **Check Stripe Dashboard**
   ```
   - Go to Stripe Dashboard > Payments
   - Verify checkout sessions use the configuration
   ```

## Edge Cases

### No Configuration Set
- Behavior: Stripe uses default payment methods
- All enabled payment methods in Stripe account will show

### Invalid Configuration ID
- Behavior: Stripe returns error
- User sees "Failed to create checkout session"
- Check Supabase logs for error details

### Empty String
- Behavior: Treated as no configuration
- Default payment methods used

## Deployment

### 1. Deploy Migration
```bash
# Copy SQL and run in Supabase SQL Editor
cat supabase/migrations/20260103_add_stripe_payment_configuration.sql
```

Or:
```bash
supabase db push
```

### 2. Deploy Edge Function
```bash
supabase functions deploy create-checkout-session
```

### 3. Configure in Admin Panel
1. Log in as admin
2. Go to Finance Settings
3. Enter payment configuration ID
4. Save

## Files Modified

1. ✅ `src/pages/FinanceSettings.jsx` - Added UI and save logic
2. ✅ `supabase/functions/create-checkout-session/index.ts` - Apply config to checkout
3. ✅ `supabase/migrations/20260103_add_stripe_payment_configuration.sql` - Database schema

## API Reference

### Edge Function Parameter
```typescript
// No new parameters needed in request
// Configuration is fetched from database automatically

// Internal: Fetched from site_settings
{
  stripe_payment_configuration: "pmc_xxxxxxxxxxxxx"
}

// Applied to Stripe session
{
  payment_method_configuration: "pmc_xxxxxxxxxxxxx"
}
```

### Database Schema
```sql
Table: site_settings
Column: stripe_payment_configuration
Type: VARCHAR
Description: Stripe Payment Configuration ID
Example: pmc_1AbCdEfGhIjKlMnO
```

## Support Links

- [Stripe Payment Configurations Documentation](https://stripe.com/docs/payments/payment-methods/integration-options#payment-method-configuration)
- [Stripe Dashboard - Payment Configurations](https://dashboard.stripe.com/settings/payment_method_configurations)
- [Available Payment Methods by Country](https://stripe.com/docs/payments/payment-methods/payment-method-support)

---

**Status**: ✅ Implementation Complete  
**Next**: Create payment configuration in Stripe Dashboard and test checkout
