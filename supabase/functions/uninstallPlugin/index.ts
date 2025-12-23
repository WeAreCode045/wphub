import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id, plugin_slug, plugin_id } = await req.json();

        console.log('[uninstallPlugin] === START ===');
        console.log('[uninstallPlugin] Site ID:', site_id);
        console.log('[uninstallPlugin] Plugin slug:', plugin_slug);
        console.log('[uninstallPlugin] Plugin ID:', plugin_id);

        if (!site_id || !plugin_slug) {
            return Response.json({ success: false, error: 'Missing required parameters: site_id and plugin_slug are required' }, { status: 400 });
        }

        const sites = await base44.entities.Site.filter({ id: site_id });
        if (sites.length === 0) {
            console.log('[uninstallPlugin] Site not found');
            return Response.json({ success: false, error: 'Site not found' }, { status: 404 });
        }
        const site = sites[0];

        console.log('[uninstallPlugin] Site:', site.name);

        const connectorUrl = `${site.url}/wp-json/wphub/v1/uninstallPlugin`;
        console.log('[uninstallPlugin] Calling connector:', connectorUrl);

        const response = await fetch(connectorUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key, plugin_slug }) });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[uninstallPlugin] Connector error:', response.status, errorText);
            return Response.json({ success: false, error: `Connector error: ${response.status} - ${errorText}` }, { status: 500 });
        }

        const result = await response.json();
        console.log('[uninstallPlugin] Connector response:', result);

        if (!result.success) {
            console.log('[uninstallPlugin] Uninstall failed:', result.message);
            return Response.json({ success: false, error: result.message || 'Uninstall failed' });
        }

        if (plugin_id) {
            try {
                const plugins = await base44.entities.Plugin.filter({ id: plugin_id });
                if (plugins.length > 0) {
                    const plugin = plugins[0];
                    const currentInstalledOn = plugin.installed_on || [];
                    const updatedInstalledOn = currentInstalledOn.filter(entry => entry.site_id !== site_id);
                    
                    await base44.entities.Plugin.update(plugin_id, { installed_on: updatedInstalledOn });
                    console.log('[uninstallPlugin] ✅ Removed site from installed_on array');
                }
            } catch (dbError) {
                console.error('[uninstallPlugin] Database update error:', dbError);
            }
        }

        try {
            await base44.entities.ActivityLog.create({ user_email: user.email, action: `Plugin gedeïnstalleerd van ${site.name}`, entity_type: "site", details: `Plugin slug: ${plugin_slug}` });
        } catch (logError) {
            console.error('[uninstallPlugin] Activity log error:', logError);
        }

        console.log('[uninstallPlugin] === END ===');

        return Response.json({ success: true, message: result.message || 'Plugin successfully uninstalled' });

    } catch (error) {
        console.error('[uninstallPlugin] ❌ ERROR:', error.message);
        console.error('[uninstallPlugin] Stack:', error.stack);
        return Response.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
    }
});