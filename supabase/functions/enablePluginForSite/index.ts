import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

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
        const sites = await base44.entities.Site.filter({ id: site_id });
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

        await base44.entities.Site.update(site_id, {
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