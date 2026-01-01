import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { ListSiteThemesRequestSchema, z } from '../_shared/schemas.ts';


Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body with Zod
    let body;
    try {
      const bodyText = await req.text();
      const parsed = JSON.parse(bodyText);
      body = ListSiteThemesRequestSchema.parse(parsed);
    } catch (parseError) {
      console.error('[listSiteThemes] Validation error:', parseError);
      const error = parseError instanceof z.ZodError
        ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        : `Invalid request: ${parseError.message}`;
      return new Response(
        JSON.stringify({ error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { site_id } = body;

    console.log('[listSiteThemes] === START ===');
    console.log('[listSiteThemes] Site ID:', site_id);

    const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
    
    if (sitesError || !sites) {
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (sites.length === 0) {
      console.log('[listSiteThemes] Site not found');
      return new Response(
        JSON.stringify({ error: 'Site not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const site = sites[0];
    console.log('[listSiteThemes] Site:', site.name, site.url);

    const wpEndpoint = `${site.url}/wp-json/wphub/v1/listThemes`;
    console.log('[listSiteThemes] Calling WordPress connector:', wpEndpoint);

    const wpResponse = await fetch(wpEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key }) });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text();
      console.error('[listSiteThemes] WordPress API error:', wpResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to connect to WordPress site', details: errorText, status: wpResponse.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await wpResponse.json();
    console.log('[listSiteThemes] WordPress returned', result.themes?.length || 0, 'themes');

    if (!result.success || !result.themes) {
      return new Response(
        JSON.stringify({ error: 'Failed to get themes from WordPress', details: result.message || 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[listSiteThemes] === END ===');

    return new Response(
      JSON.stringify({ success: true, themes: result.themes, total: result.themes.length, active_theme: result.active_theme }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[listSiteThemes] ❌ ERROR:', error.message);
    console.error('[listSiteThemes] Stack:', error.stack);
    return new Response(
      JSON.stringify({ success: false, error: error.message, stack: error.stack, themes: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});