import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id, plugin_slug } = await req.json();

        console.log('[togglePluginState] === START ===');
        console.log('[togglePluginState] Site ID:', site_id);
        console.log('[togglePluginState] Plugin slug:', plugin_slug);

        if (!site_id || !plugin_slug) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const sites = await base44.entities.Site.filter({ id: site_id });
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }
        const site = sites[0];

        console.log('[togglePluginState] Site:', site.name);
        console.log('[togglePluginState] Calling connector to toggle:', plugin_slug);

        const connectorUrl = `${site.url}/wp-json/wphub/v1/togglePlugin`;
        console.log('[togglePluginState] Calling connector:', connectorUrl);

        const response = await fetch(connectorUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: site.api_key,
                plugin_slug: plugin_slug
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[togglePluginState] Connector error:', errorText);
            return Response.json({ 
                success: false,
                error: `Connector error: ${response.status} - ${errorText}` 
            }, { status: 500 });
        }

        const result = await response.json();
        console.log('[togglePluginState] Connector response:', result);

        console.log('[togglePluginState] === END ===');

        return Response.json({
            success: result.success,
            message: result.message,
            new_status: result.new_status
        });

    } catch (error) {
        console.error('[togglePluginState] ❌ ERROR:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});
