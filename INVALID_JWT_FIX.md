# Summary: "Invalid JWT" Fix

## The Problem You Were Seeing

**Error:** `{code: 401, message: "Invalid JWT"}`

This happened because the `admin-create-plan` and `admin-update-plan` edge functions were trying to manually decode JWT tokens using `jwtDecode`, without actually validating them against Supabase's auth servers.

## Root Causes

1. **jwtDecode() doesn't validate** - It just decodes the JWT payload without checking if the signature is valid or if the token is expired
2. **No fallback error handling** - When jwtDecode failed, it threw a cryptic error
3. **Role checking was unreliable** - The functions checked `user_metadata.role` from the JWT instead of querying the database
4. **No Supabase auth API call** - Other functions in your codebase use proper Supabase auth verification, but these didn't

## The Solution

### Step 1: Checked Other Edge Functions
Reviewed how functions like `getAllUsersAdmin`, `updateUserAdmin`, etc. handle authentication and found they use the proper pattern from `_helpers.ts`:
- `authMeWithToken()` - Validates token with Supabase auth API
- `extractBearerFromReq()` - Safely extracts Bearer token from headers
- `jsonResponse()` - Consistent error/success responses

### Step 2: Updated Both Functions
**Files changed:**
- `supabase/functions/admin-create-plan/index.ts`
- `supabase/functions/admin-update-plan/index.ts`

**Changes made:**
- Removed jwtDecode import
- Added imports from _helpers.ts
- Replaced manual JWT decoding with `authMeWithToken()`
- Replaced manual role checking with database query
- Updated all responses to use jsonResponse()
- Better error messages for debugging

### Step 3: Deployed
Both functions redeployed successfully:
- ✅ `admin-create-plan` deployed
- ✅ `admin-update-plan` deployed

## What's Different Now

### Before (Broken)
```
1. Extract "Bearer TOKEN" from header
2. Decode JWT manually with jwtDecode()
   ❌ No validation!
3. Check user_metadata.role from JWT
   ❌ Unreliable source!
4. If any step fails: cryptic "Invalid JWT"
```

### After (Fixed)
```
1. Extract "Bearer TOKEN" safely with extractBearerFromReq()
2. Call Supabase auth API with authMeWithToken(token)
   ✅ Validates signature AND expiration
3. Query database for user role
   ✅ Single source of truth
4. Clear error messages if anything fails
   ✅ "Unauthorized" or "Admin access required"
```

## Testing the Fix

1. **Ensure prerequisites are met:**
   - Migration applied (role column in users table)
   - Your user has `role = 'admin'`
   - STRIPE_SECRET_KEY set in Supabase env vars

2. **Try creating a product:**
   - Go to Admin → Producten
   - Fill in product details
   - Click Create

3. **Expected outcomes:**
   - ✅ Success: Product created in dashboard and Stripe
   - ✅ Clear error if not admin: "Admin access required" (403)
   - ✅ Clear error if not authenticated: "Unauthorized" (401)

## Key Files Updated

| File | Changes |
|------|---------|
| `admin-create-plan/index.ts` | Switched to authMeWithToken pattern ✅ |
| `admin-update-plan/index.ts` | Switched to authMeWithToken pattern ✅ |
| `BILLING_AUTH_FIXES.md` | Detailed explanation of changes (new) |
| `EDGE_FUNCTION_AUTH_PATTERNS.md` | Reference for all auth patterns (new) |

## Quick Debug Checklist

If you still get errors, check:

- [ ] Did you apply the migration? `ALTER TABLE public.users ADD COLUMN role ...`
- [ ] Is your user admin? `SELECT role FROM public.users WHERE id = 'YOUR_ID'`
- [ ] Check DevTools → Network → admin-create-plan request → see exact error response
- [ ] Check Supabase dashboard → Functions → admin-create-plan → Logs for server-side errors
- [ ] Verify STRIPE_SECRET_KEY is set in Supabase function environment

## Documentation

For more details, see:
- **[BILLING_AUTH_FIXES.md](./BILLING_AUTH_FIXES.md)** - Detailed explanation and testing guide
- **[EDGE_FUNCTION_AUTH_PATTERNS.md](./EDGE_FUNCTION_AUTH_PATTERNS.md)** - Auth patterns across all edge functions
- **[SETUP_BILLING_ADMIN.md](./SETUP_BILLING_ADMIN.md)** - Initial setup instructions
- **[BILLING_SYSTEM_README.md](./BILLING_SYSTEM_README.md)** - Complete system documentation

## Next Steps

1. Test creating a subscription product
2. Verify it appears in both your dashboard and Stripe
3. Test creating additional products
4. Proceed with integrating payments for users

If you encounter any errors, check the browser console and Supabase function logs for specific error messages - they should now be much clearer!
