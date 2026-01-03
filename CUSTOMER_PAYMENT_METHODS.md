# Customer Payment Method Selection Feature

## Overview
Customers can now view and manage their saved payment methods directly in their billing account. This feature enables customers to select which payment method should be used as their default for upcoming charges.

## Components & Functions

### Edge Functions

#### 1. `get-payment-methods` (NEW)
**Purpose:** Retrieve all payment methods for the authenticated customer
**Endpoint:** `POST /functions/v1/get-payment-methods`
**Authentication:** Requires user authentication (not admin)
**Request:**
```json
{
  // No body required - uses auth token for customer identification
}
```
**Response:**
```json
{
  "payment_methods": [
    {
      "id": "pm_1234567890",
      "brand": "visa",
      "last4": "4242",
      "exp_month": 12,
      "exp_year": 2026,
      "is_default": true
    },
    {
      "id": "pm_0987654321",
      "brand": "mastercard",
      "last4": "5555",
      "exp_month": 6,
      "exp_year": 2025,
      "is_default": false
    }
  ],
  "default_payment_method": "pm_1234567890"
}
```
**Features:**
- Fetches customer's payment methods from Stripe
- Includes default payment method status for each method
- Filters to only card payment methods (type: 'card')
- Handles missing customer gracefully
- Returns formatted data with brand, last 4 digits, and expiration

#### 2. `set-default-payment-method` (NEW)
**Purpose:** Allow customer to set a payment method as their default
**Endpoint:** `POST /functions/v1/set-default-payment-method`
**Authentication:** Requires user authentication (not admin)
**Request:**
```json
{
  "payment_method_id": "pm_1234567890"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Default payment method updated successfully",
  "payment_method_id": "pm_1234567890"
}
```
**Features:**
- Verifies payment method belongs to the authenticated customer (security check)
- Updates customer's invoice settings in Stripe
- Returns success message on completion
- Includes error handling for invalid or mismatched payment methods

### Frontend Components

#### BillingAccount.tsx
**Location:** `src/pages/BillingAccount.tsx`
**Updates:**
- Integrated `useQuery` hook for `get-payment-methods` function
- Enhanced Payment Method Tab with new UI
- Added `useMutation` for setting default payment method
- Implemented React Query cache invalidation on successful updates

**Payment Method Tab Features:**
1. **Display Payment Methods:**
   - Shows all saved payment methods in a list
   - Displays card brand (VISA, MASTERCARD, etc.)
   - Shows last 4 digits of card
   - Shows expiration month/year

2. **Default Method Indicator:**
   - Green "Default" badge on the currently selected default method
   - Clear visual distinction

3. **Set as Default:**
   - "Set as Default" button for each non-default payment method
   - Disabled state while updating
   - Loading indicator during mutation

4. **Error Handling:**
   - User-friendly error messages
   - Graceful handling when no payment methods exist
   - Proper loading states

## User Flow

1. **Customer navigates to Billing & Account page**
   - Clicks "Payment Method" tab
   - Payment methods are loaded via `get-payment-methods` edge function

2. **View Saved Payment Methods**
   - List of all saved payment methods displayed
   - Each method shows card details and expiration
   - Default method is clearly marked

3. **Change Default Payment Method**
   - Customer clicks "Set as Default" on desired payment method
   - Button shows loading state during update
   - `set-default-payment-method` edge function is called
   - React Query cache is invalidated
   - Payment methods list is refreshed
   - Success confirmation is shown to user

## Technical Details

### Authentication Pattern
Both functions use the consistent authentication pattern:
```typescript
const token = extractBearerFromReq(req);
const user = await authMeWithToken(token);
if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
```

### Database Integration
Functions interact with:
- **users table:** `stripe_customer_id` field for Stripe customer lookup
- **Stripe API:** Direct calls to Stripe's `paymentMethods.list()` and `customers.update()`

### Error Handling
- No Stripe customer: Returns 404 error
- Unauthorized access: Returns 401 error
- Invalid payment method: Returns 403 error (payment method doesn't belong to customer)
- Stripe API errors: Returns 500 with error message

## Data Flow

```
Customer logs in
    ↓
Navigates to BillingAccount > Payment Method tab
    ↓
get-payment-methods edge function called
    ↓
Fetches stripe_customer_id from users table
    ↓
Calls Stripe API: stripe.paymentMethods.list()
    ↓
Returns formatted payment methods with default status
    ↓
React Query caches data
    ↓
UI renders payment methods list
    ↓
Customer clicks "Set as Default"
    ↓
set-default-payment-method edge function called
    ↓
Verifies payment method ownership
    ↓
Updates Stripe customer's invoice_settings.default_payment_method
    ↓
React Query invalidates cache
    ↓
Fresh payment methods are fetched
    ↓
UI updates to show new default method
```

## Future Enhancements

### Phase 2: Add New Payment Method
- Stripe Elements card input component
- Create payment method in Stripe
- Auto-attach to customer
- Optional: Auto-set as default if first method

### Phase 3: Payment Method Deletion
- Remove payment method from Stripe
- Prevent deletion of default method without selection replacement
- Show confirmation dialog

### Phase 4: Mobile Optimization
- Responsive design for payment method list
- Touch-friendly button sizes
- Mobile-optimized card display

## Testing Checklist

- [x] Deploy `get-payment-methods` function
- [x] Deploy `set-default-payment-method` function
- [x] Test as authenticated user with payment methods
- [x] Verify payment methods display correctly
- [x] Check default method indicator
- [x] Test "Set as Default" functionality
- [ ] Test with multiple payment methods (manual)
- [ ] Test error handling - no customer (manual)
- [ ] Test permission check - wrong user accessing payment method (manual)
- [ ] Mobile responsiveness (manual)

## Security Considerations

1. **Authentication Required:** Both functions require valid user authentication
2. **Ownership Verification:** `set-default-payment-method` verifies the payment method belongs to the customer
3. **No Admin Access:** These are customer-only endpoints, not admin endpoints
4. **Token Validation:** Uses `authMeWithToken()` for secure authentication
5. **No Data Exposure:** Only returns payment methods belonging to authenticated user

## Deployment Status

**Deployed Functions:**
- ✅ `get-payment-methods` (Supabase project: ossyxxlplvqakowiwbok)
- ✅ `set-default-payment-method` (Supabase project: ossyxxlplvqakowiwbok)

**Updated Components:**
- ✅ BillingAccount.tsx (integrated with React Query)
- ✅ Build: Successful with no errors

**Git Status:**
- ✅ Committed: a7c085f
- ✅ Pushed: to main branch

## Related Features

- **Admin Payment Methods Browser:** `list-stripe-payment-methods` edge function in FinanceSettings
- **Default Payment Method Setting:** Admin can set platform-wide default in FinanceSettings
- **Automatic Default Assignment:** `admin-assign-subscription` applies default method to new customers

## Notes for Developers

- Payment methods are synced from Stripe, not stored in local database
- Always use `stripe_customer_id` from users table to identify customer in Stripe
- React Query handles caching and refetching automatically
- Use `queryClient.invalidateQueries()` when mutations change payment method data
- Stripe API version used: 2024-11-20.acacia
- Card type filtering is applied (only 'card' type methods, no ACH, etc.)

