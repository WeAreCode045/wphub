# Stripe Embedded Checkout Integration Guide

This document describes the Stripe Embedded Checkout integration implemented in the wphub application.

## Overview

The integration enables customers to pay through an embedded Stripe Checkout form directly on your website. This provides a streamlined checkout experience while maintaining security (payment details never touch your server).

## Architecture

### Backend Components

#### 1. Create Checkout Session Endpoint
**Location:** `supabase/functions/create-checkout-session/index.ts`

Creates a Stripe Checkout Session in embedded mode.

**Request:**
```typescript
POST /functions/v1/create-checkout-session
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "price_id": "price_xxxxx",
  "quantity": 1,
  "metadata": {
    "key": "value"
  },
  "success_url": "https://example.com/success",
  "cancel_url": "https://example.com/cancel"
}
```

**Response:**
```json
{
  "clientSecret": "cs_test_xxxxx",
  "sessionId": "cs_test_xxxxx"
}
```

**Key Features:**
- Requires authenticated user with Stripe customer ID
- Uses `ui_mode: 'embedded'` for embedded checkout
- Supports custom metadata for tracking
- Returns client secret for frontend integration
- Default return URL: `/checkout/return?session_id={CHECKOUT_SESSION_ID}`

#### 2. Checkout Session Status Endpoint
**Location:** `supabase/functions/checkout-session-status/index.ts`

Retrieves the status of a completed checkout session.

**Request:**
```
GET /functions/v1/checkout-session-status?session_id=cs_test_xxxxx
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "status": "complete",
  "customer_email": "user@example.com",
  "payment_intent": "pi_xxxxx",
  "payment_status": "paid",
  "subscription": "sub_xxxxx",
  "mode": "subscription",
  "amount_total": 9900,
  "amount_subtotal": 9900
}
```

**Status Values:**
- `complete`: Payment was successful
- `open`: Payment is incomplete or was canceled
- `expired`: Checkout session has expired

### Frontend Components

#### 1. CheckoutForm Component
**Location:** `src/components/CheckoutForm.jsx`

Renders the embedded Stripe Checkout form.

**Props:**
- `priceId` (required): Stripe Price ID
- `quantity` (optional): Quantity of items (default: 1)
- `metadata` (optional): Additional metadata object
- `onSuccess` (optional): Callback when session is created
- `onCancel` (optional): Callback when user cancels

**Usage:**
```jsx
import CheckoutForm from "@/components/CheckoutForm";

<CheckoutForm
  priceId="price_xxxxx"
  quantity={1}
  metadata={{ planName: "premium" }}
  onSuccess={(sessionId) => console.log("Success:", sessionId)}
  onCancel={() => goBack()}
/>
```

**Features:**
- Automatically fetches client secret from backend
- Handles loading and error states
- Displays responsive error messages
- Submits authentication token with requests

#### 2. Checkout Page
**Location:** `src/pages/Checkout.jsx`

Main checkout page that displays available subscription plans and handles plan selection.

**Features:**
- Lists all available subscription plans
- Shows pricing, features, and trial information
- Allows users to select a plan
- Routes to CheckoutForm component
- Elegant gradient UI with responsive design

#### 3. CheckoutReturn Page
**Location:** `src/pages/CheckoutReturn.jsx`

Handles post-payment flow based on checkout session status.

**Status Handling:**
- **complete**: Shows success message with customer email
- **open**: Redirects back to checkout page with notification
- **error**: Displays error message with retry option

**Features:**
- Automatically fetches session status on load
- Loading spinner while retrieving status
- Color-coded success, error, and warning states
- Links to billing dashboard on success
- Auto-redirect to checkout on incomplete payment

## Routes

The following routes are automatically available:

| Route | Component | Purpose |
|-------|-----------|---------|
| `/Checkout` | Checkout.jsx | Plan selection and checkout entry |
| `/checkout/return` | CheckoutReturn.jsx | Post-payment status page |
| `/checkout` | Checkout.jsx | Embedded checkout form |

## Integration Steps

### 1. Prerequisites

Ensure you have:
- Stripe Secret Key (`STRIPE_SECRET_KEY`) in environment
- Stripe Publishable Key (`VITE_STRIPE_PUBLIC_KEY`) in environment
- User has Stripe Customer ID (created via `create-stripe-customer` endpoint)
- Subscription plans configured in Stripe with Price IDs

### 2. Environment Variables

Required in `.env`:
```
STRIPE_SECRET_KEY=sk_test_xxxxx
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxx
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_APP_URL=http://localhost:5173
```

### 3. Add Checkout Link

In your billing page, add a link to start checkout:

```jsx
<button onClick={() => navigate("/Checkout")}>
  Upgrade Plan
</button>
```

### 4. Testing

Use the following test card numbers:

| Scenario | Card Number | Result |
|----------|------------|--------|
| Payment succeeds | 4242424242424242 | Immediate success |
| Requires authentication | 4000002500003155 | 3D Secure required |
| Payment declined | 4000000000009995 | Declined |

## Security Considerations

1. **PCI Compliance**: Payment details go directly to Stripe, never touching your server
2. **Authentication**: All endpoints require valid JWT token
3. **Customer Verification**: User must have Stripe Customer ID
4. **CORS**: Edge functions have proper CORS headers configured
5. **Metadata**: Use metadata for tracking but avoid storing sensitive data

## Error Handling

The integration handles:
- Missing or invalid authentication tokens
- User without Stripe customer account
- Invalid price IDs
- Network errors
- Stripe API errors
- Session expiration

## Customization

### Change Checkout Mode

Modify `create-checkout-session/index.ts`:
```typescript
mode: 'subscription', // or 'payment' or 'setup'
```

### Custom Return URLs

Pass custom URLs when creating session:
```jsx
<CheckoutForm
  priceId={priceId}
  success_url="/my-success-page"
  cancel_url="/my-cancel-page"
/>
```

### Customize Appearance

Stripe Checkout appearance can be customized via:
1. Stripe Dashboard: Settings → Branding → Checkout
2. Stripe API: Use the `appearance` parameter when creating sessions

## Debugging

### Enable Logging

All edge functions log to Supabase edge function logs. View via:
```bash
supabase functions logs create-checkout-session
supabase functions logs checkout-session-status
```

### Common Issues

1. **"User does not have a Stripe customer"**
   - Solution: Call `create-stripe-customer` endpoint first

2. **"price_id is required"**
   - Solution: Ensure price ID is valid in Stripe Dashboard

3. **"Unauthorized" (401)**
   - Solution: Check that auth token is valid and included in request

4. **Checkout not loading**
   - Solution: Verify `VITE_STRIPE_PUBLIC_KEY` is correct and in env

## Next Steps

Consider implementing:
- Webhook handling for payment events
- Subscription management (pause, cancel, update)
- Invoice tracking and history
- Coupon/discount code support
- Tax calculation with Stripe Tax
- Custom email notifications

## References

- [Stripe Embedded Checkout Docs](https://docs.stripe.com/payments/accept-a-payment?platform=web&ui=embedded-form)
- [Stripe API Documentation](https://docs.stripe.com/api)
- [React Stripe.js Documentation](https://docs.stripe.com/sdks/stripejs-react)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## Support

For issues or questions:
1. Check Stripe Dashboard → Logs for API errors
2. Check Supabase edge function logs
3. Review browser console for client-side errors
4. Consult Stripe documentation for payment-specific issues
