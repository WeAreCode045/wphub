import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id, plugin_id, download_url, version } = await req.json();

        console.log('[installPlugin] === START ===');
        console.log('[installPlugin] Site ID:', site_id);
        console.log('[installPlugin] Plugin ID:', plugin_id);
        console.log('[installPlugin] Download URL:', download_url);
        console.log('[installPlugin] Version:', version);

        if (!site_id || !plugin_id || !download_url) {
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

        console.log('[installPlugin] Site:', site.name);
        console.log('[installPlugin] Plugin:', plugin.name, '(slug:', plugin.slug, ')');

        // Call connector endpoint
        const connectorUrl = `${site.url}/wp-json/wphub/v1/installPlugin`;
        console.log('[installPlugin] Calling connector:', connectorUrl);

        const response = await fetch(connectorUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: site.api_key,
                plugin_slug: plugin.slug,
                file_url: download_url,
                version: version
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[installPlugin] Connector error:', errorText);
            return Response.json({ 
                success: false,
                error: `Connector error: ${response.status} - ${errorText}` 
            }, { status: 500 });
        }

        const result = await response.json();
        console.log('[installPlugin] Connector response:', result);

        if (result.success) {
            // Update Site.plugins
            const currentPlugins = site.plugins || [];
            const pluginIndex = currentPlugins.findIndex(p => p.plugin_id === plugin_id);

            if (pluginIndex >= 0) {
                currentPlugins[pluginIndex] = {
                    plugin_id: plugin_id,
                    version: result.version || version,
                    is_installed: 1,
                    is_activated: 0
                };
            } else {
                currentPlugins.push({
                    plugin_id: plugin_id,
                    version: result.version || version,
                    is_installed: 1,
                    is_activated: 0
                });
            }

            await base44.entities.Site.update(site_id, {
                plugins: currentPlugins,
                connection_checked_at: new Date().toISOString()
            });

            // Update plugin slug if returned from WP-CLI
            if (result.slug && result.slug !== plugin.slug) {
                console.log('[installPlugin] Updating plugin slug from', plugin.slug, 'to', result.slug);
                await base44.entities.Plugin.update(plugin_id, {
                    slug: result.slug
                });
            }

            console.log('[installPlugin] ✅ Success - plugin installed');
        }

        console.log('[installPlugin] === END ===');

        return Response.json({
            success: result.success,
            message: result.message,
            version: result.version,
            slug: result.slug
        });

    } catch (error) {
        console.error('[installPlugin] ❌ ERROR:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});