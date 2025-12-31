import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { UpdatePluginRequestSchema, z } from '../_shared/schemas.ts';


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
            body = UpdatePluginRequestSchema.parse(parsed);
        } catch (parseError) {
            console.error('[updatePlugin] Validation error:', parseError);
            const error = parseError instanceof z.ZodError
                ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                : `Invalid request: ${parseError.message}`;
            return new Response(
                JSON.stringify({ error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { site_id, plugin_slug, plugin_id, download_url } = body;

        console.log('[updatePlugin] === START ===');
        console.log('[updatePlugin] Site ID:', site_id);
        console.log('[updatePlugin] Plugin slug:', plugin_slug);
        console.log('[updatePlugin] Plugin ID:', plugin_id);
        console.log('[updatePlugin] Download URL:', download_url);

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

        console.log('[updatePlugin] Site:', site.name);

        // Call connector endpoint
        const connectorUrl = `${site.url}/wp-json/wphub/v1/updatePlugin`;
        console.log('[updatePlugin] Calling connector:', connectorUrl);

        const payload = {
            api_key: site.api_key,
            plugin_slug: plugin_slug
        };

        if (download_url) {
            payload.file_url = download_url;
        }

        const response = await fetch(connectorUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[updatePlugin] Connector error:', errorText);
            return new Response(
        JSON.stringify({ success: false, error: `Connector error: ${response.status} - ${errorText}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const result = await response.json();
        console.log('[updatePlugin] Connector response:', result);

        if (result.success && plugin_id && result.version) {
            const { data: plugins, error: pluginsError } = await supabase.from('plugins').select().eq('id', plugin_id);
            if (plugins.length > 0) {
                const plugin = plugins[0];
                const currentInstalledOn = plugin.installed_on || [];
                const existingEntry = currentInstalledOn.find(entry => entry.site_id === site_id);
                
                if (existingEntry) {
                    existingEntry.version = result.version;
                    await supabase.from('plugins').update({ installed_on: currentInstalledOn });
                    console.log('[updatePlugin] ✅ Updated version in installed_on to:', result.version);
                }
            }
        }

        console.log('[updatePlugin] === END ===');

        return new Response(
        JSON.stringify({ success: result.success, message: result.message, version: result.version }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[updatePlugin] ❌ ERROR:', error.message);
        return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});