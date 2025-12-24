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

    // Get query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all';
    const role = url.searchParams.get('role') || 'all';

    // Build query
    let queryUrl = `${supa}/rest/v1/users?select=*&order=created_at.desc`;

    // Add search filter
    if (search) {
      queryUrl += `&or=(full_name.ilike.%${encodeURIComponent(search)}%,email.ilike.%${encodeURIComponent(search)}%,company.ilike.%${encodeURIComponent(search)}%)`;
    }

    // Add status filter
    if (status === 'blocked') {
      queryUrl += `&is_blocked=eq.true`;
    } else if (status === 'active') {
      queryUrl += `&is_blocked=eq.false`;
    }

    // Add role filter
    if (role !== 'all') {
      queryUrl += `&role=eq.${encodeURIComponent(role)}`;
    }

    // Add pagination
    const offset = (page - 1) * limit;
    queryUrl += `&limit=${limit}&offset=${offset}`;

    // Fetch users
    const usersRes = await fetch(queryUrl, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });

    if (!usersRes.ok) {
      const txt = await usersRes.text().catch(()=>'');
      return jsonResponse({ error: `Failed to fetch users: ${txt}` }, 500);
    }

    const users = await usersRes.json();

    // Get total count for pagination
    let countQueryUrl = `${supa}/rest/v1/users?select=id&count=exact`;

    if (search) {
      countQueryUrl += `&or=(full_name.ilike.%${encodeURIComponent(search)}%,email.ilike.%${encodeURIComponent(search)}%,company.ilike.%${encodeURIComponent(search)}%)`;
    }

    if (status === 'blocked') {
      countQueryUrl += `&is_blocked=eq.true`;
    } else if (status === 'active') {
      countQueryUrl += `&is_blocked=eq.false`;
    }

    if (role !== 'all') {
      countQueryUrl += `&role=eq.${encodeURIComponent(role)}`;
    }

    const countRes = await fetch(countQueryUrl, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });

    const total = countRes.ok ? parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0') : 0;

    return jsonResponse({
      users,
      total,
      page,
      limit,
      hasMore: (page * limit) < total
    });
  } catch (err: any) {
    console.error('getAllUsersAdmin error', err);
    return jsonResponse({ success: false, error: err.message || String(err) }, 500);
  }
});

export {};