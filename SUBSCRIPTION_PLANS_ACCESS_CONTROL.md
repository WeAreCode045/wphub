# Subscription Plans Management - Access Control Setup

## Overview

The `subscription_plans` table is a Stripe foreign table in Supabase. Since foreign tables don't support Row-Level Security (RLS) in PostgreSQL, we've implemented access control through an Edge Function instead.

## Architecture

### Components

1. **Edge Function**: `manageSubscriptionPlans` 
   - Location: `/supabase/functions/manageSubscriptionPlans/index.ts`
   - Status: ✅ Deployed to Supabase
   - Purpose: Centralized admin access to subscription_plans table

2. **Frontend Page**: `SubscriptionPlans`
   - Location: `/src/pages/SubscriptionPlans.jsx`
   - Status: ✅ Updated to use edge function
   - Features: Create, Read, Update, Delete (CRUD) operations

3. **Database**: `subscription_plans` (Foreign Table)
   - Origin: Stripe integration
   - Access: Controlled via service role key in edge function

## Access Control Flow

```
User (Admin) 
    ↓
Frontend (SubscriptionPlans page)
    ↓ (HTTP request with auth token)
Edge Function (manageSubscriptionPlans)
    ↓ (Auth validation + admin check)
Database (subscription_plans table)
    ↓ (Service role access)
Stripe Integration
```

## Security Features

### 1. Authentication Check
- Function verifies user's auth token
- Only authenticated users can proceed
- Returns 401 if auth header missing or invalid

### 2. Admin Role Verification
- Checks if user has `role = 'admin'` in users table
- Returns 403 if user is not admin
- Prevents unauthorized modifications

### 3. Actions Supported

| Action | HTTP Method | Requires Admin | Purpose |
|--------|-----------|---|---------|
| list | POST | Yes | Fetch all subscription plans |
| create | POST | Yes | Create new subscription plan |
| update | POST | Yes | Update existing plan |
| delete | POST | Yes | Delete subscription plan |

## API Endpoint

**URL**: `{SUPABASE_URL}/functions/v1/manageSubscriptionPlans`

**Request Format**:
```json
{
  "action": "list|create|update|delete",
  "plan": {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "active": "boolean",
    "default_price": "string (Stripe price ID)",
    "attrs": "object"
  }
}
```

**Response**: 
- Success: 200 OK with plan data (array or single object)
- Unauthorized: 401 Unauthorized
- Forbidden: 403 Forbidden (not admin)
- Error: 500 with error message

## Testing

### 1. As Admin User
```javascript
// Fetch plans
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/manageSubscriptionPlans`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'list' }),
  }
);
```

### 2. As Non-Admin User
- Request will return 403 Forbidden
- Error message: "Admin access required"

### 3. Without Authentication
- Request will return 401 Unauthorized
- Error message: "Missing authorization header"

## Frontend Integration

The `SubscriptionPlans.jsx` page uses TanStack Query mutations with the edge function:

```javascript
// Query - Fetch plans
useQuery({
  queryKey: ['admin-subscription-plans'],
  queryFn: async () => {
    const token = await getSessionToken();
    const response = await fetch(
      `${VITE_SUPABASE_URL}/functions/v1/manageSubscriptionPlans`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'list' }),
      }
    );
    return await response.json();
  },
});

// Mutations - Create, Update, Delete
useMutation({
  mutationFn: async (planData) => {
    // Similar pattern for create/update/delete actions
  },
});
```

## File Locations

| File | Purpose | Status |
|------|---------|--------|
| `/supabase/functions/manageSubscriptionPlans/index.ts` | Edge function for admin operations | ✅ Deployed |
| `/supabase/migrations/20260101000000_subscription_plans_rls.sql` | Migration notes (informational) | ℹ️ Reference only |
| `/src/pages/SubscriptionPlans.jsx` | Admin interface for plan management | ✅ Updated |
| `/src/api/supabaseClient.js` | Entity definitions | ✅ Updated with getByUserId() helpers |

## Why Not Direct RLS?

Foreign tables in PostgreSQL don't support RLS policies. This is a PostgreSQL limitation, not a Supabase limitation. Solutions:

### Option 1: Edge Function (✅ Chosen)
- Pros: Simple, flexible, no database changes needed
- Cons: Additional network hop
- Status: Implemented

### Option 2: Database View with RLS
- Pros: Pure SQL-based RLS
- Cons: Complex for Stripe foreign tables, risk of data inconsistency
- Status: Not implemented

### Option 3: Service Role Only
- Pros: Secure backend-only access
- Cons: Limits frontend admin capabilities
- Status: Not chosen (frontend admin UI needed)

## Deployment Status

✅ **Edge Function**: Deployed successfully
✅ **Frontend Page**: Updated to use edge function
✅ **Admin Interface**: Ready for use
⏳ **Migration File**: Created (informational only)

## Next Steps

1. **Test Access**: Log in as admin user and test CRUD operations in `/SubscriptionPlans` page
2. **Monitor Usage**: Check Supabase Function Logs dashboard for any errors
3. **Create Initial Plans**: Add subscription plans via admin interface
4. **Link to Pricing**: Update `/Pricing` page to display available plans

## Troubleshooting

### Function Returns 401
- Check if user is authenticated
- Verify auth token is valid
- Check Authorization header format: `Bearer {token}`

### Function Returns 403
- Verify user's role is 'admin' in users table
- Check if user record exists
- Query: `SELECT id, email, role FROM users WHERE id = '{user_id}'`

### Function Returns 500
- Check Supabase Function Logs
- Verify database connection
- Check if subscription_plans table exists and is accessible
- Review error message in response

### Plans Not Loading in Frontend
- Check browser console for fetch errors
- Verify VITE_SUPABASE_URL environment variable is set
- Check if user is authenticated
- Review network tab for request/response details

## Security Considerations

1. **Token Expiration**: Supabase auth tokens expire after 1 hour. Frontend handles refresh automatically.
2. **Service Role Key**: Used only server-side in edge function, never exposed to client
3. **Admin Verification**: Every request checks admin status, prevents privilege escalation
4. **Input Validation**: Frontend validates required fields before sending to function

## Related Documentation

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Row-Level Security (RLS)](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Foreign Tables](https://supabase.com/docs/guides/database/extensions/postgres_fdw)
- [Stripe Integration](https://supabase.com/docs/guides/integrations/stripe)
