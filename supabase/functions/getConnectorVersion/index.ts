import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { site_id } = await req.json();

        if (!site_id) {
            return Response.json({ error: 'Missing site_id' }, { status: 400 });
        }

        // Get site details
        const sites = await base44.asServiceRole.entities.Site.filter({ id: site_id });
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
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
            return Response.json({ 
                success: false,
                error: 'Failed to get plugins from site' 
            }, { status: 500 });
        }

        const result = await response.json();
        
        if (!result.success || !result.plugins) {
            return Response.json({ 
                success: false,
                error: 'Invalid response from connector' 
            }, { status: 500 });
        }

        // Find connector plugin in the list
        const connectorPlugin = result.plugins.find(p => 
            p.slug === 'wp-plugin-hub-connector' || 
            p.name === 'WP Plugin Hub Connector'
        );

        if (!connectorPlugin) {
            return Response.json({
                success: false,
                error: 'Connector plugin not found on site'
            }, { status: 404 });
        }

        // Get active connector version from settings
        const settings = await base44.asServiceRole.entities.SiteSettings.list();
        const activeVersion = settings.find(s => s.setting_key === 'active_connector_version')?.setting_value;

        return Response.json({
            success: true,
            current_version: connectorPlugin.version,
            latest_version: activeVersion,
            update_available: activeVersion && connectorPlugin.version !== activeVersion
        });

    } catch (error) {
        console.error('[getConnectorVersion] ERROR:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});