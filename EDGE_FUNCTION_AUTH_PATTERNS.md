# Edge Function Auth Pattern Reference

## How Other Edge Functions Handle Authentication

The codebase has several patterns for auth. Here's what works best:

### ✅ Pattern 1: Using _helpers.ts (RECOMMENDED)

**Used by:** `getAllUsersAdmin`, `updateUserAdmin`, `deleteUserAdmin`, etc.

```typescript
import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';

Deno.serve(async (req) => {
  // Extract token from Authorization header
  const token = extractBearerFromReq(req);
  
  // Verify token with Supabase auth API
  const caller = await authMeWithToken(token);
  if (!caller) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  
  // Now check specific permissions (admin, role, etc.)
  if (caller.id !== some_user_id) {
    return jsonResponse({ error: 'Access denied' }, 403);
  }
  
  // Proceed with operation
  return jsonResponse({ success: true });
});
```

**Why this works:**
- `authMeWithToken()` calls Supabase auth API (`/auth/v1/user`)
- This validates the token signature AND expiration
- Returns the actual authenticated user object
- Clear error handling

### ⚠️ Pattern 2: Using jwtDecode (NOT RECOMMENDED - Our old approach)

**Used by:** Some billing functions (before our fix)

```typescript
import { jwtDecode } from "https://esm.sh/jwt-decode@4.0.0";

const token = authHeader.replace("Bearer ", "");
const decoded = jwtDecode<JWTPayload>(token);
const userId = decoded.sub;
```

**Problems:**
- ❌ No validation that token is actually valid
- ❌ Expired tokens still decode successfully
- ❌ No check against Supabase auth servers
- ❌ Cryptic "Invalid JWT" errors when something goes wrong

### ✅ Pattern 3: Using Supabase JS Client

**Used by:** `create-stripe-customer`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Option A: Use service role to query users
const { data: user } = await supabase
  .from("users")
  .select("*")
  .eq("id", userId)
  .single();

// Option B: Use RLS to verify access
const { data } = await supabase
  .from("user_data")
  .select("*")
  .eq("id", requester_id);
// RLS policy will prevent access if user doesn't have permission
```

**When to use:**
- When you need to query the database anyway
- When RLS policies can enforce permission
- Less suitable for pure auth verification

---

## Comparison Table

| Feature | JWT Decode | authMeWithToken | Supabase Client |
|---------|-----------|-----------------|-----------------|
| Token validation | ❌ No | ✅ Yes (calls auth API) | ✅ Via RLS |
| Expiry check | ❌ No | ✅ Yes | ✅ Yes |
| User lookup | ❌ Manual | ✅ Automatic | ✅ Query-based |
| Error messages | ❌ Vague | ✅ Clear | ✅ Detailed |
| Performance | ✅ Fast | ⚠️ HTTP call | ⚠️ DB query |
| Reliability | ❌ Low | ✅ High | ✅ High |

---

## What _helpers.ts Provides

### `authMeWithToken(token: string | null)`

```typescript
/**
 * Verify JWT token with Supabase auth servers
 * Returns the authenticated user object if valid
 * Returns null if token is invalid/expired
 */
export async function authMeWithToken(token: string | null) {
  if (!token) return null;
  
  const url = `${SUPABASE_URL}/auth/v1/user`;
  const headers = {
    Authorization: `Bearer ${token}`,
    apikey: SERVICE_KEY,
  };
  
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return await res.json(); // User object with id, email, etc.
}
```

### `extractBearerFromReq(req: Request)`

```typescript
/**
 * Extract Bearer token from Authorization header
 * Handles case-insensitive header names
 * Returns null if no token found
 */
export function extractBearerFromReq(req: Request) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const m = auth.match(/Bearer\s+(.+)/i);
  return m ? m[1] : null;
}
```

### `jsonResponse(data: any, status = 200)`

```typescript
/**
 * Send JSON response with proper CORS headers
 */
export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), { 
    status, 
    headers: { 
      ...corsHeaders,
      'Content-Type': 'application/json' 
    } 
  });
}
```

---

## Migration Guide: Old → New Pattern

### Before
```typescript
import { jwtDecode } from "...jwt-decode...";

const token = authHeader.replace("Bearer ", "");
const decoded = jwtDecode<JWTPayload>(token);
const userId = decoded.sub;
```

### After
```typescript
import { authMeWithToken, extractBearerFromReq } from '../_helpers.ts';

const token = extractBearerFromReq(req);
const caller = await authMeWithToken(token);
if (!caller) {
  return jsonResponse({ error: "Unauthorized" }, 401);
}
const userId = caller.id;
```

---

## Examples from Codebase

### ✅ Good: getAllUsersAdmin/index.ts
```typescript
const token = extractBearerFromReq(req);
const caller = await authMeWithToken(token);
if (!caller) return jsonResponse({ error: 'Unauthorized' }, 401);

// Then check for admin role
const adminRes = await fetch(`${supa}/rest/v1/users?id=eq.${caller.id}`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
});
const admin = (await adminRes.json())?.[0];
if (admin?.role !== 'admin') return jsonResponse({ error: 'Admin only' }, 403);
```

### ✅ Good: create-stripe-customer/index.ts
```typescript
const token = authHeader.replace("Bearer ", "");
const decoded = jwtDecode<JWTPayload>(token);
const userId = decoded.sub;
// Then uses supabase client to query and update
```

### ❌ Bad (Before Fix): admin-create-plan/index.ts
```typescript
const token = authHeader.replace("Bearer ", "");
const decoded = jwtDecode<JWTPayload>(token);
// ❌ No validation, no error handling, relies on JWT metadata
```

### ✅ Good (After Fix): admin-create-plan/index.ts
```typescript
const token = extractBearerFromReq(req);
const caller = await authMeWithToken(token);
if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);

const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${caller.id}`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
});
const admin = (await adminRes.json())?.[0];
if (admin?.role !== 'admin') return jsonResponse({ error: 'Admin required' }, 403);
```

---

## Best Practices

1. **Always validate tokens** with `authMeWithToken()` instead of just decoding
2. **Use extractBearerFromReq()** for consistent header parsing
3. **Return clear errors** using jsonResponse helper
4. **Check permissions in database**, not JWT metadata
5. **Use RLS policies** when possible for declarative security
6. **Log auth failures** for debugging and security monitoring

---

## See Also

- [_helpers.ts](./supabase/functions/_helpers.ts) - Full implementation
- [getAllUsersAdmin](./supabase/functions/getAllUsersAdmin/index.ts) - Good example
- [admin-create-plan](./supabase/functions/admin-create-plan/index.ts) - Fixed version
- [BILLING_AUTH_FIXES.md](./BILLING_AUTH_FIXES.md) - Auth fix details
