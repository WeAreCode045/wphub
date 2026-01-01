import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';


Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth header from request
    const authHeader = req.headers.get('Authorization');
    
    // Create client with user's auth token if available, otherwise use service role
    let supabase;
    if (authHeader) {
      supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
    } else {
      supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
    }

    const { site_id } = await req.json();

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

        // Call connector to get installed plugins (includes connector itself)
        const connectorUrl = `${site.url}/wp-json/wphub/v1/listPlugins`;
        
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
            return new Response(
        JSON.stringify({ 
                success: false,
                error: 'Failed to get plugins from site' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const result = await response.json();
        
        if (!result.success || !result.plugins) {
            return new Response(
        JSON.stringify({ 
                success: false,
                error: 'Invalid response from connector' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Find connector plugin in the list
        const connectorPlugin = result.plugins.find(p => 
            p.slug === 'wphub-connector' || 
            p.name === 'WP Hub Connector'
        );

        if (!connectorPlugin) {
            return new Response(
        JSON.stringify({
                success: false,
                error: 'Connector plugin not found on site'
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Get active connector version from settings
        const { data: settings, error: settingsError } = await supabase.from('sitesettings').select();
        const activeVersion = settings?.find(s => s.setting_key === 'active_connector_version')?.setting_value;

        return new Response(
        JSON.stringify({
            success: true,
            current_version: connectorPlugin.version,
            latest_version: activeVersion,
            update_available: activeVersion && connectorPlugin.version !== activeVersion
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[getConnectorVersion] ERROR:', error.message);
        return new Response(
        JSON.stringify({ 
            success: false,
            error: error.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});