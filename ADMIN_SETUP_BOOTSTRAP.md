# Admin Setup Bootstrap Guide

## Problem

When you try to access the Product Management page to create subscription plans, you get an error:

```
Your role has not been set. Contact an administrator.
// OR
You do not have permission to access this page. Your role: user
```

This is because your user account doesn't have the `admin` role yet.

## Solution

### Option 1: Manual Setup via Supabase Dashboard (Recommended)

1. **Get Your User ID**
   - Go to: https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/auth/users
   - Click on your user email address
   - Copy the `User ID` (UUID format, like `8a3d7170-75b2-4a5a-aaf9-312735ae2bb0`)

2. **Set Admin Role**
   - Go to: https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/sql/new
   - Run this SQL command (replace YOUR_USER_ID):

   ```sql
   UPDATE public.users 
   SET role = 'admin' 
   WHERE id = 'YOUR_USER_ID';
   ```

   Example:
   ```sql
   UPDATE public.users 
   SET role = 'admin' 
   WHERE id = '8a3d7170-75b2-4a5a-aaf9-312735ae2bb0';
   ```

3. **Verify**
   - Run this query to confirm:
   ```sql
   SELECT id, role FROM public.users WHERE id = 'YOUR_USER_ID';
   ```

4. **Reload App**
   - Refresh the page or logout/login
   - You should now see the Product Management page

### Option 2: Programmatically (Future Enhancement)

Once you have ONE admin, you can use the admin dashboard to add more admins without needing SQL access.

This would require implementing a "Users/Roles" management page (currently under development).

## Understanding the System

### Database Tables

- **auth.users**: Managed by Supabase Auth (user credentials)
- **public.users**: Custom extension with additional fields:
  - `id` (linked to auth.users.id)
  - `role`: 'admin', 'user', or custom role
  - `stripe_customer_id`: For billing
  - `subscription_updated_at`: Last subscription change

### Role Permissions

| Role | Can Access | Can Do |
|------|-----------|--------|
| `user` | Main app | Use sites, plugins, themes |
| `admin` | Admin pages | Create subscription plans, manage users |

### Edge Functions

When you call an edge function that requires admin:

1. **Frontend** sends Authorization header with JWT token
2. **Edge function** extracts user ID from JWT
3. **Edge function** queries `public.users` to get `role`
4. **Edge function** checks if `role = 'admin'`
5. **Edge function** allows/denies action

Example (admin-create-plan):
```typescript
// Extract user ID from JWT
const payload = getJWTPayload(token);
const userId = payload.sub;

// Query database for role
const { data: userData } = await supabase
  .from("users")
  .select("role")
  .eq("id", userId)
  .single();

// Check role
if (userData.role !== 'admin') {
  return { error: 'Admin access required' }, 403;
}
```

## Troubleshooting

### Issue: "User not found" (404 error)

**Cause**: Your user ID doesn't exist in `public.users` table

**Solution**: 
- Log out and log in again (may trigger auto-creation)
- Or manually insert: 
  ```sql
  INSERT INTO public.users (id, role) 
  VALUES ('YOUR_USER_ID', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin';
  ```

### Issue: "Unauthorized" (401 error)

**Cause**: JWT token is invalid or not being sent

**Solution**:
- Clear browser cookies
- Log out and log in again
- Check browser console (F12) for network errors

### Issue: "Admin access required" (403 error)

**Cause**: Your user exists but role is not 'admin'

**Solution**:
- Use the UPDATE SQL command above
- Verify with: `SELECT id, role FROM public.users;`

## Next Steps

Once you're admin, you can:

1. ✅ Access Product Management (`/dashboard/products`)
2. ✅ Create subscription plans  
3. ✅ Link plans to Stripe products
4. 🔜 Add users and assign roles (UI in development)

## Verification Checklist

Before trying to create a product, verify:

- [ ] You've logged in with a Supabase account
- [ ] You can access the main dashboard
- [ ] Your user exists in `public.users` table
- [ ] Your role is set to `'admin'` (not `'user'` or NULL)
- [ ] You've refreshed the page after updating the role
- [ ] No error toast appears on the Products page

## Still Having Issues?

1. Check Supabase function logs:
   - Dashboard → Functions → admin-create-plan → Logs
   - Look for detailed error messages

2. Check browser console:
   - Press F12 → Console tab
   - Look for network errors when clicking "Create Product"

3. Database verification:
   ```sql
   -- Check all users
   SELECT id, role FROM public.users ORDER BY created_at DESC;

   -- Check your specific user
   SELECT * FROM public.users WHERE id = 'YOUR_USER_ID';

   -- Check auth table
   SELECT id, email FROM auth.users WHERE id = 'YOUR_USER_ID';
   ```
