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

        const { site_id, plugin_id } = await req.json();

        console.log('[deactivatePlugin] === START ===');
        console.log('[deactivatePlugin] Site ID:', site_id);
        console.log('[deactivatePlugin] Plugin ID:', plugin_id);

        if (!site_id || !plugin_id) {
            return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
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

        // Get plugin details
        const { data: plugins, error: pluginsError } = await supabase.from('plugins').select().eq('id', plugin_id);
                if (pluginsError || !plugins) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (plugins.length === 0) {
            return new Response(
        JSON.stringify({ error: 'Plugin not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        const plugin = plugins[0];

        console.log('[deactivatePlugin] Plugin:', plugin.name, '(slug:', plugin.slug, ')');

        // Call connector endpoint
        const connectorUrl = `${site.url}/wp-json/wphub/v1/deactivatePlugin`;
        console.log('[deactivatePlugin] Calling connector:', connectorUrl);

        const response = await fetch(connectorUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: site.api_key,
                plugin_slug: plugin.slug
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[deactivatePlugin] Connector error:', errorText);
            return new Response(
        JSON.stringify({ 
                success: false,
                error: `Connector error: ${response.status} - ${errorText}` 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const result = await response.json();
        console.log('[deactivatePlugin] Connector response:', result);

        if (result.success) {
            // Update Site.plugins
            const currentPlugins = site.plugins || [];
            const pluginIndex = currentPlugins.findIndex(p => p.plugin_id === plugin_id);

            if (pluginIndex >= 0) {
                currentPlugins[pluginIndex].is_activated = 0;
            }

            await supabase.from('sites').update({
                plugins: currentPlugins,
                connection_checked_at: new Date().toISOString()
            });

            console.log('[deactivatePlugin] ✅ Success - plugin deactivated');
        }

        console.log('[deactivatePlugin] === END ===');

        return new Response(
        JSON.stringify({
            success: result.success,
            message: result.message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[deactivatePlugin] ❌ ERROR:', error.message);
        return new Response(
        JSON.stringify({ 
            success: false,
            error: error.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});