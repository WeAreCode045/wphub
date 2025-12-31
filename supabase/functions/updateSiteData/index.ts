import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';


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

        const { site_id } = await req.json();

        console.log('[updateSiteData] === START ===');
        console.log('[updateSiteData] Site ID:', site_id);

        if (!site_id) {
            return new Response(
        JSON.stringify({ error: 'Missing site_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Get site details
        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
                if (sitesError || !sites) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (sites.length === 0) {
            return new Response(
        JSON.stringify({ error: 'Site not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        const site = sites[0];

        console.log('[updateSiteData] Site:', site.name);

        // Call connector endpoint to get WP version
        const connectorUrl = `${site.url}/wp-json/wphub/v1/getWordPressVersion`;
        console.log('[updateSiteData] Calling connector:', connectorUrl);

        const response = await fetch(connectorUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: site.api_key
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[updateSiteData] Connector error:', errorText);
            return new Response(
        JSON.stringify({ 
                success: false,
                error: `Connector error: ${response.status} - ${errorText}` 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const result = await response.json();
        console.log('[updateSiteData] Connector response:', result);

        if (result.success) {
            await supabase.from('sites').update({
                wp_version: result.wp_version,
                connection_checked_at: new Date().toISOString(),
                status: 'active'
            });

            console.log('[updateSiteData] ✅ Success - WordPress version updated to', result.wp_version);
        }

        console.log('[updateSiteData] === END ===');

        return new Response(
        JSON.stringify({
            success: result.success,
            wp_version: result.wp_version,
            message: result.message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[updateSiteData] ❌ ERROR:', error.message);
        return new Response(
        JSON.stringify({ 
            success: false,
            error: error.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});