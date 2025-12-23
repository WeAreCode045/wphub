import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id, plugin_slug, plugin_id, download_url } = await req.json();

        console.log('[updatePlugin] === START ===');
        console.log('[updatePlugin] Site ID:', site_id);
        console.log('[updatePlugin] Plugin slug:', plugin_slug);
        console.log('[updatePlugin] Plugin ID:', plugin_id);
        console.log('[updatePlugin] Download URL:', download_url);

        if (!site_id || !plugin_slug) {
            return Response.json({ error: 'Site ID and plugin slug are required' }, { status: 400 });
        }

        // Get site details
        const sites = await base44.entities.Site.filter({ id: site_id });
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
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
            return Response.json({ success: false, error: `Connector error: ${response.status} - ${errorText}` }, { status: 500 });
        }

        const result = await response.json();
        console.log('[updatePlugin] Connector response:', result);

        if (result.success && plugin_id && result.version) {
            const plugins = await base44.entities.Plugin.filter({ id: plugin_id });
            if (plugins.length > 0) {
                const plugin = plugins[0];
                const currentInstalledOn = plugin.installed_on || [];
                const existingEntry = currentInstalledOn.find(entry => entry.site_id === site_id);
                
                if (existingEntry) {
                    existingEntry.version = result.version;
                    await base44.entities.Plugin.update(plugin_id, { installed_on: currentInstalledOn });
                    console.log('[updatePlugin] ✅ Updated version in installed_on to:', result.version);
                }
            }
        }

        console.log('[updatePlugin] === END ===');

        return Response.json({ success: result.success, message: result.message, version: result.version });

    } catch (error) {
        console.error('[updatePlugin] ❌ ERROR:', error.message);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});