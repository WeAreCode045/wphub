import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { site_id } = await req.json();

        console.log('[listSitePlugins] === START ===');
        console.log('[listSitePlugins] Site ID:', site_id);

        if (!site_id) {
            return Response.json({ error: 'Site ID is required' }, { status: 400 });
        }

        const sites = await base44.asServiceRole.entities.Site.filter({ id: site_id });
        
        if (sites.length === 0) {
            console.log('[listSitePlugins] Site not found');
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }

        const site = sites[0];
        console.log('[listSitePlugins] Site:', site.name, site.url);

        const wpEndpoint = `${site.url}/wp-json/wphub/v1/listPlugins`;
        console.log('[listSitePlugins] Calling WordPress connector:', wpEndpoint);

        const wpResponse = await fetch(wpEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key }) });

        if (!wpResponse.ok) {
            const errorText = await wpResponse.text();
            console.error('[listSitePlugins] WordPress API error:', wpResponse.status, errorText);
            return Response.json({ error: 'Failed to connect to WordPress site', details: errorText, status: wpResponse.status }, { status: 502 });
        }

        const result = await wpResponse.json();
        console.log('[listSitePlugins] WordPress returned', result.plugins?.length || 0, 'plugins');

        if (!result.success || !result.plugins) {
            return Response.json({ error: 'Failed to get plugins from WordPress', details: result.message || 'Unknown error' }, { status: 500 });
        }

        await base44.asServiceRole.entities.Site.update(site_id, { connection_status: 'active', connection_checked_at: new Date().toISOString() });

        const allPlatformPlugins = await base44.asServiceRole.entities.Plugin.list();
        console.log('[listSitePlugins] Found', allPlatformPlugins.length, 'platform plugins');

        const wpPluginSlugs = result.plugins.map(p => p.slug);
        
        for (const platformPlugin of allPlatformPlugins) {
            const currentInstalledOn = platformPlugin.installed_on || [];
            let needsUpdate = false;
            let updatedInstalledOn = [...currentInstalledOn];

            const wpPlugin = result.plugins.find(p => p.slug === platformPlugin.slug);

            if (wpPlugin) {
                const existingEntry = updatedInstalledOn.find(entry => entry.site_id === site_id);
                
                if (!existingEntry) {
                    console.log('[listSitePlugins] Adding', platformPlugin.slug, 'to installed_on for site', site_id);
                    updatedInstalledOn.push({ site_id: site_id, version: wpPlugin.version });
                    needsUpdate = true;
                } else if (existingEntry.version !== wpPlugin.version) {
                    console.log('[listSitePlugins] Updating version for', platformPlugin.slug, 'on site', site_id, 'from', existingEntry.version, 'to', wpPlugin.version);
                    existingEntry.version = wpPlugin.version;
                    needsUpdate = true;
                }
            } else {
                const entryIndex = updatedInstalledOn.findIndex(entry => entry.site_id === site_id);
                if (entryIndex !== -1) {
                    console.log('[listSitePlugins] Removing', platformPlugin.slug, 'from installed_on for site', site_id);
                    updatedInstalledOn.splice(entryIndex, 1);
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await base44.asServiceRole.entities.Plugin.update(platformPlugin.id, { installed_on: updatedInstalledOn });
                console.log('[listSitePlugins] ✅ Updated installed_on for plugin:', platformPlugin.slug);
            }
        }

        console.log('[listSitePlugins] Reconciliation complete');
        console.log('[listSitePlugins] === END ===');

        return Response.json({ success: true, plugins: result.plugins, total: result.plugins.length });

    } catch (error) {
        console.error('[listSitePlugins] ❌ ERROR:', error.message);
        console.error('[listSitePlugins] Stack:', error.stack);
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});