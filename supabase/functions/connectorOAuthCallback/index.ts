import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supaUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supaUrl || !serviceKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET: Generate OAuth URL for Supabase login
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
        .from('Site')
        .select('id, url, name')
        .eq('user_id', user_id);

      if (sitesError) {
        console.error('Error fetching user sites:', sitesError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch user sites' }),
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
        return new Response(
          JSON.stringify({ 
            error: 'Your WordPress site URL was not found in your platform sites',
            wordpress_url: wordpress_url,
            user_sites: (sites || []).map((s: any) => s.url)
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate or get existing API key for this site
      const { data: existingKey } = await supabase
        .from('SiteApiKey')
        .select('key')
        .eq('site_id', matching_site.id)
        .single();

      let api_key = existingKey?.key;

      if (!api_key) {
        // Generate a new API key
        const new_key = crypto.getRandomValues(new Uint8Array(32));
        const key_hex = Array.from(new_key).map(b => b.toString(16).padStart(2, '0')).join('');
        
        const { error: createError } = await supabase
          .from('SiteApiKey')
          .insert({
            site_id: matching_site.id,
            key: key_hex,
          });

        if (createError) {
          console.error('Error creating API key:', createError);
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
