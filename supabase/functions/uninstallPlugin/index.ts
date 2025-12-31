import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { UninstallPluginRequestSchema, z } from '../_shared/types.ts';

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
            body = UninstallPluginRequestSchema.parse(parsed);
        } catch (parseError) {
            console.error('[uninstallPlugin] Validation error:', parseError);
            const error = parseError instanceof z.ZodError
                ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                : `Invalid request: ${parseError.message}`;
            return new Response(
                JSON.stringify({ error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { site_id, plugin_slug, plugin_id } = body;

        console.log('[uninstallPlugin] === START ===');
        console.log('[uninstallPlugin] Site ID:', site_id);
        console.log('[uninstallPlugin] Plugin slug:', plugin_slug);
        console.log('[uninstallPlugin] Plugin ID:', plugin_id);

        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
                if (sitesError || !sites) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (sites.length === 0) {
            console.log('[uninstallPlugin] Site not found');
            return new Response(
        JSON.stringify({ success: false, error: 'Site not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        const site = sites[0];

        console.log('[uninstallPlugin] Site:', site.name);

        const connectorUrl = `${site.url}/wp-json/wphub/v1/uninstallPlugin`;
        console.log('[uninstallPlugin] Calling connector:', connectorUrl);

        const response = await fetch(connectorUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key, plugin_slug }) });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[uninstallPlugin] Connector error:', response.status, errorText);
            return new Response(
        JSON.stringify({ success: false, error: `Connector error: ${response.status} - ${errorText}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const result = await response.json();
        console.log('[uninstallPlugin] Connector response:', result);

        if (!result.success) {
            console.log('[uninstallPlugin] Uninstall failed:', result.message);
            return new Response(
        JSON.stringify({ success: false, error: result.message || 'Uninstall failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        if (plugin_id) {
            try {
                const { data: plugins, error: pluginsError } = await supabase.from('plugins').select().eq('id', plugin_id);
                if (plugins.length > 0) {
                    const plugin = plugins[0];
                    const currentInstalledOn = plugin.installed_on || [];
                    const updatedInstalledOn = currentInstalledOn.filter(entry => entry.site_id !== site_id);
                    
                    await supabase.from('plugins').update({ installed_on: updatedInstalledOn });
                    console.log('[uninstallPlugin] ✅ Removed site from installed_on array');
                }
            } catch (dbError) {
                console.error('[uninstallPlugin] Database update error:', dbError);
            }
        }

        try {
            await supabase.from('activitylogs').insert({ user_email: user.email, action: `Plugin gedeïnstalleerd van ${site.name}`, entity_type: "site", details: `Plugin slug: ${plugin_slug}` });
        } catch (logError) {
            console.error('[uninstallPlugin] Activity log error:', logError);
        }

        console.log('[uninstallPlugin] === END ===');

        return new Response(
        JSON.stringify({ success: true, message: result.message || 'Plugin successfully uninstalled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[uninstallPlugin] ❌ ERROR:', error.message);
        console.error('[uninstallPlugin] Stack:', error.stack);
        return new Response(
        JSON.stringify({ success: false, error: error.message, stack: error.stack }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});