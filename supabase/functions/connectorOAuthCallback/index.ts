import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supaUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supaUrl || !anonKey || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET: Generate OAuth URL for Supabase login (PUBLIC - no auth required)
    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url);
      const wordpress_url = searchParams.get('wordpress_url');
      const redirect_uri = searchParams.get('redirect_uri');

      if (!wordpress_url || !redirect_uri) {
        return new Response(
          JSON.stringify({ error: 'wordpress_url and redirect_uri are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate state token for CSRF protection
      const state = crypto.getRandomValues(new Uint8Array(32)).toString();
      
      // Build Supabase OAuth URL
      const oauth_url = `${supaUrl}/auth/v1/authorize?client_id=${anonKey}&response_type=code&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=user&state=${encodeURIComponent(state)}`;

      return new Response(
        JSON.stringify({
          success: true,
          oauth_url: oauth_url,
          state: state,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Handle OAuth callback and auto-connect
    if (req.method === 'POST') {
      const body = await req.json();
      const { access_token, wordpress_url, user_id } = body;

      if (!access_token || !wordpress_url || !user_id) {
        return new Response(
          JSON.stringify({ error: 'access_token, wordpress_url, and user_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(supaUrl, serviceKey);

      // Find the user's site that matches the WordPress URL
      const { data: sites, error: sitesError } = await supabase
        .from('sites')
        .select('id, url, name, api_key')
        .eq('owner_type', 'user')
        .eq('owner_id', user_id);

      console.log('Looking up sites for user_id:', user_id);
      console.log('Query: owner_type=user AND owner_id=user_id');
      console.log('Raw database sites:', sites);

      if (sitesError) {
        console.error('Error fetching user sites:', sitesError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch user sites',
            details: sitesError.message || JSON.stringify(sitesError),
            user_id: user_id
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Normalize URLs for comparison
      const normalize_url = (url: string) => {
        return url.toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '');
      };

      const normalized_wp_url = normalize_url(wordpress_url);
      const matching_site = (sites || []).find((site: any) => 
        normalize_url(site.url) === normalized_wp_url
      );

      if (!matching_site) {
        console.log('URL mismatch - Normalized WP URL:', normalized_wp_url);
        console.log('Available sites:', (sites || []).map((s: any) => ({ url: s.url, normalized: normalize_url(s.url) })));
        return new Response(
          JSON.stringify({ 
            error: 'Your WordPress site URL was not found in your platform sites',
            wordpress_url: wordpress_url,
            normalized_wordpress_url: normalized_wp_url,
            user_sites: (sites || []).map((s: any) => s.url),
            normalized_user_sites: (sites || []).map((s: any) => normalize_url(s.url))
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate or get existing API key for this site
      // The api_key is stored directly in the sites table
      let api_key = matching_site.api_key;

      if (!api_key) {
        // Generate a new API key
        const new_key = crypto.getRandomValues(new Uint8Array(32));
        const key_hex = Array.from(new_key).map(b => b.toString(16).padStart(2, '0')).join('');
        
        const { error: updateError } = await supabase
          .from('sites')
          .update({ api_key: key_hex })
          .eq('id', matching_site.id);

        if (updateError) {
          console.error('Error updating site with API key:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to create API key' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        api_key = key_hex;
      }

      return new Response(
        JSON.stringify({
          success: true,
          site_id: matching_site.id,
          site_name: matching_site.name,
          api_key: api_key,
          platform_url: supaUrl,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in connectorOAuthCallback:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
