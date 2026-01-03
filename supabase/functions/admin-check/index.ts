import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const token = extractBearerFromReq(req);
    const user = await authMeWithToken(token);
    
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Initialize Supabase with SERVICE_ROLE_KEY
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!serviceRoleKey) {
      return jsonResponse({ error: 'Service role key not configured' }, 500);
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Get user info from database
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, is_admin, role')
      .eq('id', user.id)
      .single();

    if (userError) {
      return jsonResponse({
        authenticated_user_id: user.id,
        authenticated_user_email: user.email,
        database_query_error: userError.message,
        error: 'Failed to query user from database'
      }, 200);
    }

    // Check both is_admin and role
    const isAdmin = userData?.is_admin === true || userData?.role === 'admin';

    return jsonResponse({
      authenticated_user_id: user.id,
      authenticated_user_email: user.email,
      database_user: userData,
      is_admin_in_db: userData?.is_admin || false,
      user_role: userData?.role || 'unknown',
      is_admin_by_role: userData?.role === 'admin',
      is_admin_overall: isAdmin,
      can_sync: isAdmin
    }, 200);

  } catch (error) {
    console.error('Error in admin-check:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
