# Stripe Customer Sync Feature

## Overview
Admins can now synchronize users without Stripe customer IDs by creating new Stripe customers or linking existing ones. This feature automatically checks if a customer already exists in Stripe before creating a duplicate.

## Edge Function

### `admin-sync-stripe-customers` (NEW)
**Purpose:** Sync all users without `stripe_customer_id` by creating or linking Stripe customers
**Endpoint:** `POST /functions/v1/admin-sync-stripe-customers`
**Authentication:** Admin only (verified via `is_admin` flag)

**Request:**
```json
{
  // No body required - uses auth token for admin verification
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 42 users",
  "results": [
    {
      "user_id": "uuid-1",
      "email": "user@example.com",
      "status": "created",
      "stripe_customer_id": "cus_1234567890"
    },
    {
      "user_id": "uuid-2",
      "email": "another@example.com",
      "status": "linked",
      "stripe_customer_id": "cus_0987654321"
    },
    {
      "user_id": "uuid-3",
      "email": "error@example.com",
      "status": "error",
      "error": "Failed to update user: database error"
    }
  ],
  "summary": {
    "total": 3,
    "created": 1,
    "linked": 1,
    "errors": 1
  }
}
```

## Workflow

```
Admin clicks "Stripe Klanten Synchroniseren" button
    ↓
Confirmation dialog shown
    ↓
admin-sync-stripe-customers edge function called
    ↓
Fetches all users with stripe_customer_id = NULL
    ↓
For each user:
    1. Check if Stripe customer exists with same email
    2. If found: Link existing customer ID to user
    3. If not found: Create new Stripe customer
    4. Update user record with stripe_customer_id
    ↓
Returns detailed results with summary
    ↓
Shows success alert with:
    - Total users processed
    - New customers created
    - Existing customers linked
    - Number of errors (if any)
    ↓
Invalidates React Query cache
```

## Function Details

### Algorithm
1. **Fetch Users:** Get all users where `stripe_customer_id IS NULL`
2. **For Each User:**
   - Query Stripe API: `stripe.customers.list({ email: user.email, limit: 1 })`
   - If customer found:
     - Link existing customer ID to user in database
     - Mark as "linked" in results
   - If no customer found:
     - Create new customer: `stripe.customers.create({ email, metadata })`
     - Save customer ID to user in database
     - Mark as "created" in results
   - If error occurs:
     - Log error message
     - Mark as "error" in results
3. **Return Summary:** Count and categorize results

### Error Handling
- **No Stripe Key:** Returns 500 error with "Stripe secret key not configured"
- **Not Admin:** Returns 403 "Admin access required"
- **Not Authenticated:** Returns 401 "Unauthorized"
- **Database Error:** Caught per user, marks as "error" and continues
- **Stripe API Error:** Caught per user, marks as "error" and continues

### Stripe Metadata
When creating new customers, the following metadata is set:
```json
{
  "metadata": {
    "platform_user_id": "user-uuid"
  }
}
```

This ensures traceability between platform users and Stripe customers.

## User Interface

### Location
**Page:** FinanceSettings.jsx
**Tab:** "Stripe Instellingen" (Stripe Settings)
**Section:** "Stripe Klanten Synchroniseren" (Sync Stripe Customers)

### Components
- **Button:** Orange/amber gradient button with Users icon
- **Info Box:** Explains what will happen:
  - Checks for existing customers by email
  - Links or creates customers as needed
- **Confirmation Dialog:** Warns that operation might take time
- **Status Alert:** Shows results after sync completes

### User Experience
1. Admin navigates to FinanceSettings → "Stripe Instellingen" tab
2. Scrolls to "Stripe Klanten Synchroniseren" card
3. Clicks button - confirmation dialog appears
4. Confirms action
5. Button shows loading state: "Synchroniseren..."
6. After completion, alert shows:
   ```
   ✅ Stripe klanten gesynchroniseerd!
   
   Totaal verwerkt: 42
   Nieuw aangemaakt: 5
   Gekoppeld aan bestaande: 37
   Fouten: 0
   ```

## Integration with Other Features

### Admin-Assign-Subscription
When assigning subscriptions, if customer doesn't exist or needs a payment method, this sync ensures the customer is properly set up in Stripe first.

### Customer Payment Methods
After sync, customers have proper Stripe customer records, enabling them to:
- View saved payment methods (get-payment-methods)
- Change default payment method (set-default-payment-method)

## Database Impact

### users Table
- **Field Updated:** `stripe_customer_id`
- **Values Changed:** NULL → `cus_xxxxx` (Stripe customer ID)
- **Condition:** Only users with NULL stripe_customer_id

### No Changes To
- stripe.customers table (read-only from Stripe API)
- stripe.payment_methods table
- user_subscriptions table

## Performance Considerations

### Time Complexity
- O(n) where n = number of users without stripe_customer_id
- For each user: 1 Stripe API call (list) + 1 database update
- Large batches might take several minutes

### Recommendations
- Run during off-peak hours for large batches
- Typical: ~2-5 seconds per user
- 100 users: ~3-8 minutes

### Stripe API Rate Limits
- Default: 100 requests per second
- This function respects rate limiting
- Should not hit limits unless running concurrently with other high-volume operations

## Security

### Authentication
- Requires valid Supabase auth token
- Must have `is_admin = true` in users table
- Token extracted from Bearer header

### Authorization
- Admin-only endpoint
- No way for regular users to trigger sync
- Returns 403 if user is not admin

### Data Privacy
- Only accesses user email and ID
- Metadata sent to Stripe includes only platform user ID
- Results show email (necessary for tracing)

## Testing Checklist

- [x] Deploy admin-sync-stripe-customers function
- [x] Update FinanceSettings component
- [x] Build frontend successfully
- [ ] Test as admin user (manual)
  - [ ] Navigate to Stripe Settings tab
  - [ ] Verify sync button appears
  - [ ] Click sync button
  - [ ] Confirm dialog works
  - [ ] Monitor results
- [ ] Test with no users to sync
- [ ] Test with some users already having stripe_customer_id
- [ ] Verify existing customers are linked correctly
- [ ] Verify new customers are created
- [ ] Check database stripe_customer_id values updated
- [ ] Verify Stripe Dashboard shows new customers
- [ ] Test error handling (disable auth, etc.)

## Deployment Status

- ✅ Edge function deployed: `admin-sync-stripe-customers`
- ✅ Frontend updated: FinanceSettings.jsx
- ✅ Build successful
- ✅ Committed to git (commit: 5b7dc8f)
- ✅ Pushed to main branch

## Related Documentation

- [Customer Payment Methods](./CUSTOMER_PAYMENT_METHODS.md) - Customer-facing payment method management
- [Admin Subscription Management](./BILLING_DOCUMENTATION_INDEX.md) - Assigning subscriptions to users
- [Stripe Integration](./BILLING_SYSTEM_README.md) - Overview of Stripe integration

## Developer Notes

### Key Functions
```typescript
// List customers by email
const existingCustomers = await stripe.customers.list({
  email: userRecord.email,
  limit: 1,
});

// Create new customer
const newCustomer = await stripe.customers.create({
  email: userRecord.email,
  metadata: { platform_user_id: userRecord.id }
});

// Update user with customer ID
await supabaseClient
  .from('users')
  .update({ stripe_customer_id: stripeCustomerId })
  .eq('id', userRecord.id);
```

### Error Recovery
If sync is interrupted:
- Some users may be updated, others not
- No duplicates will be created (checks before creating)
- Rerunning sync will:
  - Skip already synced users
  - Continue with remaining users
  - Show overall progress

### Future Enhancements
1. Batch progress updates via WebSocket
2. Pause/resume functionality
3. Selective sync (by created date, email domain, etc.)
4. Automatic sync on schedule
5. Export sync results to CSV

