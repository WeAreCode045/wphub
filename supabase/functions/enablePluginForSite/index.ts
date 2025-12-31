import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { EnablePluginForSiteRequestSchema, z } from '../_shared/schemas.ts';


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
            body = EnablePluginForSiteRequestSchema.parse(parsed);
        } catch (parseError) {
            console.error('[enablePluginForSite] Validation error:', parseError);
            const error = parseError instanceof z.ZodError
                ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                : `Invalid request: ${parseError.message}`;
            return new Response(
                JSON.stringify({ error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { site_id, plugin_id, enabled } = body;

        console.log('[enablePluginForSite] Site ID:', site_id);
        console.log('[enablePluginForSite] Plugin ID:', plugin_id);
        console.log('[enablePluginForSite] Enabled:', enabled);

        // Get site
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

        const currentPlugins = site.plugins || [];
        const pluginIndex = currentPlugins.findIndex(p => p.plugin_id === plugin_id);

        if (enabled) {
            // Add plugin to site's plugins list
            if (pluginIndex < 0) {
                currentPlugins.push({
                    plugin_id: plugin_id,
                    version: null,
                    is_installed: 0,
                    is_activated: 0
                });
            }
        } else {
            // Remove plugin from site's plugins list
            if (pluginIndex >= 0) {
                currentPlugins.splice(pluginIndex, 1);
            }
        }

        await supabase.from('sites').update({
            plugins: currentPlugins
        });

        console.log('[enablePluginForSite] ✅ Success');

        return new Response(
        JSON.stringify({
            success: true,
            message: enabled ? 'Plugin enabled for site' : 'Plugin disabled for site'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[enablePluginForSite] ❌ ERROR:', error.message);
        return new Response(
        JSON.stringify({ 
            success: false,
            error: error.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});