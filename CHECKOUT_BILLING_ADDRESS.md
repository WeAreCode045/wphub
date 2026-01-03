# Billing Address & Checkout Enhancement

## Overview
Added billing address collection to AccountSettings and enhanced checkout with plan details overview.

## Changes Made

### 1. Account Settings Page (AccountSettings.jsx)
**New Billing Address Section:**
- Address field (street + house number)
- City field
- Postal code field
- Country dropdown (NL, BE, DE, FR, GB, US)
- VAT number field (optional, for business customers)

**Fields stored in `public.users` table:**
```javascript
- billing_address (VARCHAR 500)
- billing_city (VARCHAR 255)
- billing_postal_code (VARCHAR 50)
- billing_country (VARCHAR 2, default 'NL')
- vat_number (VARCHAR 50)
```

### 2. Checkout Page (Checkout.jsx)
**Enhanced:**
- Passes `selectedPlan` object to CheckoutForm
- Determines `billingPeriod` ("monthly" or "yearly") from selected price ID
- Enables plan overview display

### 3. Checkout Form (CheckoutForm.jsx)
**New Features:**

#### A. Plan Details Overview Card
Displays before payment:
- Plan name
- Billing period (Monthly/Yearly)
- Price in euros
- Trial period (if applicable)
- **Start date** (today)
- **Next billing date** (calculated: today + trial_days + billing_period)

#### B. Billing Data Integration
- Fetches user's billing address from `users` table
- Passes billing details to Stripe checkout session:
  ```javascript
  billing_details: {
    address: {
      line1: billing_address,
      city: billing_city,
      postal_code: billing_postal_code,
      country: billing_country
    },
    tax_id: {
      type: 'eu_vat',
      value: vat_number  // if provided
    }
  }
  ```

#### C. Enhanced Metadata
Checkout session now includes:
- `plan_name` - for tracking
- `billing_period` - "monthly" or "yearly"

### 4. Database Migration (20260103_add_billing_address_to_users.sql)
**SQL Changes:**
```sql
ALTER TABLE public.users
ADD COLUMN billing_address VARCHAR(500),
ADD COLUMN billing_city VARCHAR(255),
ADD COLUMN billing_postal_code VARCHAR(50),
ADD COLUMN billing_country VARCHAR(2) DEFAULT 'NL',
ADD COLUMN vat_number VARCHAR(50);

CREATE INDEX idx_users_billing_country ON public.users(billing_country);
```

## User Flow

### Setting Up Billing Address
1. User navigates to Account Settings
2. Scrolls to "Factuurgegevens" (Billing Details) section
3. Fills in address, city, postal code, country
4. Optionally adds VAT number (for EU business customers)
5. Clicks "Wijzigingen Opslaan" (Save Changes)
6. Data saved to `public.users` table

### Checkout Process
1. User selects a plan (monthly or yearly)
2. **Plan Details Overview** displays:
   - Plan name and price
   - Billing period
   - Start date (today)
   - Next billing date (with trial calculation)
3. Coupon section (optional)
4. Stripe Embedded Checkout loads with:
   - Pre-filled billing address (if saved)
   - VAT number for tax calculation (if provided)
   - Payment options (card, Apple Pay, Google Pay, etc.)
5. User completes payment

## Benefits

### For Users
✅ **No re-entry**: Billing address saved once, used in all checkouts  
✅ **Transparent pricing**: See exact start and billing dates before payment  
✅ **VAT handling**: Automatic EU VAT reverse charge for businesses  
✅ **Trial clarity**: Shows when first payment will be charged

### For Business
✅ **Compliance**: Proper billing address collection for invoicing  
✅ **Tax accuracy**: VAT numbers enable reverse charge mechanism  
✅ **Analytics**: Track billing periods and plan selections  
✅ **UX improvement**: Clear plan overview reduces payment abandonment

## Edge Function Update Needed

The `create-checkout-session` edge function should be updated to handle:
```typescript
interface CheckoutSessionRequest {
  price_id: string;
  quantity?: number;
  coupon_code?: string;
  billing_details?: {
    address?: {
      line1?: string;
      city?: string;
      postal_code?: string;
      country?: string;
    };
    tax_id?: {
      type: 'eu_vat';
      value: string;
    };
  };
  metadata?: Record<string, string>;
}

// Pass billing_details to Stripe:
const session = await stripe.checkout.sessions.create({
  // ... existing params
  customer_update: {
    address: 'auto',
    name: 'auto',
  },
  billing_address_collection: 'auto',
  tax_id_collection: {
    enabled: true,
  },
  // Pre-fill from user data if available
  ...(billing_details?.address && {
    invoice_creation: {
      enabled: true,
      invoice_data: {
        custom_fields: billing_details.tax_id ? [{
          name: 'VAT Number',
          value: billing_details.tax_id.value,
        }] : [],
      },
    },
  }),
});
```

## Testing Checklist

- [ ] Save billing address in Account Settings
- [ ] Verify data saved to `users` table
- [ ] Select monthly plan in Checkout
- [ ] Verify plan overview shows correct dates
- [ ] Select yearly plan in Checkout
- [ ] Verify yearly billing date calculation
- [ ] Check Stripe checkout pre-fills address
- [ ] Test VAT number passes to Stripe
- [ ] Verify checkout without billing address (optional flow)
- [ ] Test coupon + billing address combination

## Files Changed

1. ✅ `src/pages/AccountSettings.jsx` - Added billing address section
2. ✅ `src/pages/Checkout.jsx` - Pass plan + period to form
3. ✅ `src/components/CheckoutForm.jsx` - Plan overview + billing integration
4. ✅ `supabase/migrations/20260103_add_billing_address_to_users.sql` - DB schema
5. ⏳ `supabase/functions/create-checkout-session/index.ts` - Handle billing_details

## Migration Deployment

Run this SQL in Supabase SQL Editor to add billing fields:
```bash
# Copy migration content
cat supabase/migrations/20260103_add_billing_address_to_users.sql

# Paste and execute in Supabase Dashboard > SQL Editor
```

Or use Supabase CLI:
```bash
supabase db push
```

---

**Status**: ✅ Implementation Complete  
**Next**: Deploy migration and update `create-checkout-session` edge function
