import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';


Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

    try {
        const { site_id } = await req.json();

        console.log('[getWordPressPluginData] === START ===');
        console.log('[getWordPressPluginData] Site ID:', site_id);

        if (!site_id) {
            return new Response(
        JSON.stringify({ error: 'Site ID is required' }),
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
            console.log('[getWordPressPluginData] Site not found');
            return new Response(
        JSON.stringify({ error: 'Site not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const site = sites[0];
        console.log('[getWordPressPluginData] Site:', site.name, site.url);

        // Call WordPress REST API to get all plugins using connector endpoint
        const wpEndpoint = `${site.url}/wp-json/wphub/v1/getInstalledPlugins`;
        console.log('[getWordPressPluginData] Calling WordPress connector:', wpEndpoint);

        const wpResponse = await fetch(wpEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: site.api_key
            })
        });

        if (!wpResponse.ok) {
            const errorText = await wpResponse.text();
            console.error('[getWordPressPluginData] WordPress API error:', wpResponse.status, errorText);
            return new Response(
        JSON.stringify({ 
                error: 'Failed to connect to WordPress site',
                details: errorText,
                status: wpResponse.status
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const result = await wpResponse.json();
        console.log('[getWordPressPluginData] WordPress returned', result.plugins?.length || 0, 'plugins');

        if (!result.success || !result.plugins) {
            return new Response(
        JSON.stringify({ 
                error: 'Failed to get plugins from WordPress',
                details: result.message || 'Unknown error'
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Format plugins data
        const plugins = result.plugins.map(plugin => ({
            name: plugin.name,
            slug: plugin.slug,
            version: plugin.version,
            description: plugin.description || '',
            is_active: plugin.is_active || false
        }));

        console.log('[getWordPressPluginData] === END ===');
        console.log('[getWordPressPluginData] Returning', plugins.length, 'plugins');

        return new Response(
        JSON.stringify({ 
            success: true,
            plugins: plugins,
            total: plugins.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[getWordPressPluginData] ❌ ERROR:', error.message);
        console.error('[getWordPressPluginData] Stack:', error.stack);
        return new Response(
        JSON.stringify({ 
            error: error.message,
            stack: error.stack
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});