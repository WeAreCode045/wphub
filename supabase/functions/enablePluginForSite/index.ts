import { createClient } from 'jsr:@supabase/supabase-js@2'


Deno.serve(async (req) => {
    try {
        const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id, plugin_id, enabled } = await req.json();

        console.log('[enablePluginForSite] Site ID:', site_id);
        console.log('[enablePluginForSite] Plugin ID:', plugin_id);
        console.log('[enablePluginForSite] Enabled:', enabled);

        if (!site_id || !plugin_id || enabled === undefined) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Get site
        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
                if (sitesError || !sites) {
            return Response.json({ error: 'Database error' }, { status: 500 });
        }
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
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

        return Response.json({
            success: true,
            message: enabled ? 'Plugin enabled for site' : 'Plugin disabled for site'
        });

    } catch (error) {
        console.error('[enablePluginForSite] ❌ ERROR:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});