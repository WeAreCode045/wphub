import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id, plugin_id } = await req.json();

        console.log('[deactivatePlugin] === START ===');
        console.log('[deactivatePlugin] Site ID:', site_id);
        console.log('[deactivatePlugin] Plugin ID:', plugin_id);

        if (!site_id || !plugin_id) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Get site details
        const sites = await base44.entities.Site.filter({ id: site_id });
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }
        const site = sites[0];

        // Get plugin details
        const plugins = await base44.entities.Plugin.filter({ id: plugin_id });
        if (plugins.length === 0) {
            return Response.json({ error: 'Plugin not found' }, { status: 404 });
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
            return Response.json({ 
                success: false,
                error: `Connector error: ${response.status} - ${errorText}` 
            }, { status: 500 });
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

            await base44.entities.Site.update(site_id, {
                plugins: currentPlugins,
                connection_checked_at: new Date().toISOString()
            });

            console.log('[deactivatePlugin] ✅ Success - plugin deactivated');
        }

        console.log('[deactivatePlugin] === END ===');

        return Response.json({
            success: result.success,
            message: result.message
        });

    } catch (error) {
        console.error('[deactivatePlugin] ❌ ERROR:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});