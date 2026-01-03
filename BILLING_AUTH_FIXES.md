# Billing System Auth Fixes

## Changes Made

### ✅ Replaced JWT Decode with Proper Token Verification

The edge functions (`admin-create-plan` and `admin-update-plan`) were using `jwtDecode` to manually decode JWT tokens. This approach had several issues:

**Problems with JWT decode approach:**
- ❌ No validation that the token is actually valid
- ❌ Vulnerable to expired or tampered tokens
- ❌ Hardcoded role checking on user_metadata (not reliable)
- ❌ Could throw cryptic "Invalid JWT" errors

**New approach using Supabase auth API:**
- ✅ Verifies token against Supabase auth servers (proper validation)
- ✅ Gets actual authenticated user object
- ✅ Checks admin role from database table (source of truth)
- ✅ Returns clear error messages for debugging

### 📝 Updated Functions

Both functions now use the proper pattern:

```typescript
import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';

// Extract token from Authorization header
const token = extractBearerFromReq(req);

// Verify token against Supabase auth API
const caller = await authMeWithToken(token);
if (!caller) {
  return jsonResponse({ error: "Unauthorized" }, 401);
}

// Check admin role from database
const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${caller.id}`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
});
const admin = adminArr?.[0];
if (!admin || admin.role !== "admin") {
  return jsonResponse({ error: "Admin access required" }, 403);
}
```

### 🔧 Functions Updated

1. **`supabase/functions/admin-create-plan/index.ts`**
   - Replaced jwtDecode with authMeWithToken
   - Now queries users table for role verification
   - Uses jsonResponse helper for consistent responses
   - Deployed ✅

2. **`supabase/functions/admin-update-plan/index.ts`**
   - Same improvements as admin-create-plan
   - Deployed ✅

## Testing the Fix

### Prerequisites

1. **Migration applied**: `role` column exists in `public.users`
2. **Your user is admin**: `UPDATE public.users SET role = 'admin' WHERE id = 'YOUR_ID';`
3. **Stripe keys configured**:
   - `.env`: `VITE_STRIPE_PUBLIC_KEY=pk_test_...`
   - Supabase env vars: `STRIPE_SECRET_KEY=sk_test_...`

### Test Steps

1. **Sign in to the app**
2. **Go to Admin → Producten (Products)**
3. **Click "Nieuw Abonnement" (New Subscription)**
4. **Fill in test data**:
   ```
   Name: "Test Plan"
   Description: "A test subscription"
   Monthly: $9.99
   Yearly: $99.00
   Trial Days: 14
   ```
5. **Click "Aanmaken" (Create)**

### Expected Results

**Success:**
- Toast: "Abonnementsplan en Stripe product succesvol aangemaakt"
- New plan appears in the list
- Check Stripe dashboard - product created there too

**If you get "401 Unauthorized":**
- Check token is being sent: Open DevTools → Network → Click request → Headers
- Look for `Authorization: Bearer eyJ...` header
- If missing, the frontend code needs fixing

**If you get "Admin access required" (403):**
- Verify your user is admin: `SELECT id, role FROM public.users;`
- Update role if needed: `UPDATE public.users SET role = 'admin' WHERE id = 'YOUR_ID';`

**If you get other errors:**
- Check edge function logs in Supabase dashboard
- Look for any Stripe API errors
- Verify STRIPE_SECRET_KEY is set in Supabase env vars

## Browser Console Debugging

If something goes wrong, check the browser console:

```javascript
// The error message should tell you what went wrong:
// - "Unauthorized" → Token not verified by Supabase
// - "Admin access required" → User doesn't have admin role
// - "Stripe error: ..." → Stripe API issue
```

## Database Verification

Check the state of your billing setup:

```sql
-- Check users table has role column
SELECT id, email, role FROM public.users LIMIT 5;

-- Check subscription plans table
SELECT id, name, stripe_product_id FROM public.subscription_plans;

-- Check if you're admin
SELECT * FROM public.users WHERE email = 'your@email.com';
```

## What Changed Under the Hood

### Before (Broken)
```
Frontend → Edge Function
  → jwtDecode(token) [no validation]
  → Check decoded.user_metadata.role [unreliable]
  → ❌ "Invalid JWT" error (unclear)
```

### After (Fixed)
```
Frontend → Edge Function
  → extractBearerFromReq(token)
  → authMeWithToken(token)
    → Verify with Supabase auth API
    → Return actual user object
  → Query users table for role [source of truth]
  → ✅ Clear error if not admin
```

## Related Documentation

- [SETUP_BILLING_ADMIN.md](./SETUP_BILLING_ADMIN.md) - Initial setup instructions
- [BILLING_SYSTEM_README.md](./BILLING_SYSTEM_README.md) - Complete billing system docs
- [_helpers.ts](./supabase/functions/_helpers.ts) - Auth helper functions

## Support

If you're still getting "Invalid JWT" errors:

1. Check DevTools Network tab for the exact error response
2. Check Supabase function logs (Dashboard → Functions → admin-create-plan)
3. Verify all environment variables are set correctly
4. Make sure migration has been applied (`role` column exists)
5. Make sure your user has `role = 'admin'` in the database
