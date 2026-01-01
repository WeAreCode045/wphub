import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';
import { corsHeaders } from '../_helpers.ts';
import { UpdateUserAdminRequestSchema, z } from '../_shared/schemas.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    // Parse and validate request body
    let body;
    try {
      const bodyText = await req.text();
      const parsed = JSON.parse(bodyText);
      body = UpdateUserAdminRequestSchema.parse(parsed);
    } catch (parseError) {
      const error = parseError instanceof z.ZodError
        ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        : `Invalid request: ${parseError.message}`;
      return jsonResponse({ error }, 400);
    }

    const { user_id, updates } = body;

    // Validate updates - only allow certain fields
    const allowedFields = ['full_name', 'avatar_url', 'company', 'phone', 'role', 'status', 'email_notifications', 'two_factor_enabled', 'disabled'];
    const filteredUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }
    if (Object.keys(filteredUpdates).length === 0) return jsonResponse({ error: 'No valid fields to update' }, 400);

    // Update user
    filteredUpdates.updated_at = new Date().toISOString();
    const updateRes = await fetch(`${supa}/rest/v1/users?id=eq.${encodeURIComponent(user_id)}`, {
      method: 'PATCH',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(filteredUpdates)
    });
    if (!updateRes.ok) {
      const txt = await updateRes.text().catch(()=>'');
      return jsonResponse({ error: `Failed to update user: ${txt}` }, 500);
    }
    const updatedUser = await updateRes.json();

    // Log activity
    await fetch(`${supa}/rest/v1/activity_logs`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_email: admin.email,
        action: `User updated: ${updatedUser.email}`,
        entity_type: 'user',
        details: `Updated fields: ${Object.keys(filteredUpdates).join(', ')}`
      })
    });

    return jsonResponse({ success: true, user: updatedUser });
  } catch (err: any) {
    console.error('updateUserAdmin error', err);
    return jsonResponse({ success: false, error: err.message || String(err) }, 500);
  }
});

export {};