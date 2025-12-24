import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';

Deno.serve(async (req: Request) => {
  try {
    const token = extractBearerFromReq(req);
    const caller = await authMeWithToken(token);
    if (!caller) return jsonResponse({ error: 'Unauthorized' }, 401);

    // Check if caller is admin by fetching from users table
    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const adminRes = await fetch(`${supa}/rest/v1/users?id=eq.${encodeURIComponent(caller.id)}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (!adminRes.ok) return jsonResponse({ error: 'Failed to verify admin' }, 500);
    const adminArr = await adminRes.json();
    const admin = adminArr?.[0];
    if (!admin || admin.role !== 'admin') return jsonResponse({ error: 'Admin access required' }, 403);

    const { user_id } = await req.json();
    if (!user_id) return jsonResponse({ error: 'user_id is required' }, 400);

    // Delete user from auth
    const deleteAuthUrl = `${supa}/auth/v1/admin/users/${user_id}`;
    const deleteAuthRes = await fetch(deleteAuthUrl, {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });

    if (!deleteAuthRes.ok) {
      const txt = await deleteAuthRes.text().catch(()=>'');
      return jsonResponse({ error: `Failed to delete user from auth: ${txt}` }, 500);
    }

    // Delete user from users table
    const deleteUserRes = await fetch(`${supa}/rest/v1/users?id=eq.${encodeURIComponent(user_id)}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });

    if (!deleteUserRes.ok) {
      const txt = await deleteUserRes.text().catch(()=>'');
      return jsonResponse({ error: `Failed to delete user from database: ${txt}` }, 500);
    }

    // Log activity
    await fetch(`${supa}/rest/v1/activity_logs`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_email: admin.email,
        action: `User deleted: ${user_id}`,
        entity_type: 'user',
        details: 'User completely removed from system'
      })
    });

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error('deleteUserAdmin error', err);
    return jsonResponse({ success: false, error: err.message || String(err) }, 500);
  }
});

export {};