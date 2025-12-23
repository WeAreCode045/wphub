import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
    const base44 = createClientFromRequest(req);
    const { api_key, wp_version, plugins, site_url } = await req.json();

        console.log('[syncSiteData] === START ===');
        console.log('[syncSiteData] Received data:', { api_key: api_key ? 'YES' : 'NO', wp_version, site_url });
        console.log('[syncSiteData] Plugins data:', JSON.stringify(plugins));

        if (!api_key) {
            return Response.json({ error: 'API key is required' }, { status: 401 });
        }

        // Find site by API key using service role
        const sites = await base44.asServiceRole.entities.Site.filter({ api_key });
        
        if (sites.length === 0) {
            console.log('[syncSiteData] Invalid API key');
            return Response.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const site = sites[0];
        console.log('[syncSiteData] Site found:', site.name, '(ID:', site.id, ')');

        // Update site data
        await base44.asServiceRole.entities.Site.update(site.id, {
            last_connection: new Date().toISOString(),
            wp_version: wp_version || site.wp_version,
            status: 'active'
        });

        console.log('[syncSiteData] Site updated successfully');

        // Update plugin installations status
        if (plugins && Array.isArray(plugins)) {
            console.log('[syncSiteData] Processing', plugins.length, 'plugins');

            const installations = await base44.asServiceRole.entities.PluginInstallation.filter({ 
                site_id: site.id 
            });

            console.log('[syncSiteData] Found', installations.length, 'installations for this site');

            for (const pluginData of plugins) {
                const installation = installations.find(i => i.plugin_id === pluginData.plugin_id);
                
                if (installation) {
                    console.log('[syncSiteData] Updating installation for plugin:', pluginData.plugin_id);
                    console.log('[syncSiteData] - is_active from WP:', pluginData.is_active);
                    console.log('[syncSiteData] - version from WP:', pluginData.version);
                    console.log('[syncSiteData] - current status:', installation.status);
                    console.log('[syncSiteData] - current installed_version:', installation.installed_version);

                    // Determine new status based on WordPress state
                    let newStatus = installation.status;
                    
                    // If WordPress reports it has a version installed
                    if (pluginData.version) {
                        // Plugin is installed on WordPress
                        if (pluginData.is_active) {
                            newStatus = 'active';
                        } else {
                            newStatus = 'inactive';
                        }
                    } else {
                        // Plugin is not installed on WordPress
                        if (installation.is_enabled) {
                            newStatus = 'available';
                        } else {
                            newStatus = 'unavailable';
                        }
                    }

                    console.log('[syncSiteData] - new status will be:', newStatus);

                    await base44.asServiceRole.entities.PluginInstallation.update(installation.id, {
                        is_active: pluginData.is_active,
                        status: newStatus,
                        installed_version: pluginData.version || null,
                        last_sync: new Date().toISOString()
                    });

                    console.log('[syncSiteData] ✅ Installation updated successfully');
                } else {
                    console.log('[syncSiteData] ⚠️ No installation found for plugin:', pluginData.plugin_id);
                }
            }
        }

        console.log('[syncSiteData] === END ===');

        return Response.json({ 
            success: true, 
            message: 'Site data synchronized successfully',
            site_id: site.id
        });

    } catch (error) {
        console.error('[syncSiteData] ❌ ERROR:', error.message);
        console.error('[syncSiteData] Stack:', error.stack);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});