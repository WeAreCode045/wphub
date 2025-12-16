import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { site_id } = await req.json();

        console.log('[getWordPressPluginData] === START ===');
        console.log('[getWordPressPluginData] Site ID:', site_id);

        if (!site_id) {
            return Response.json({ error: 'Site ID is required' }, { status: 400 });
        }

        // Get site details
        const sites = await base44.asServiceRole.entities.Site.filter({ id: site_id });
        
        if (sites.length === 0) {
            console.log('[getWordPressPluginData] Site not found');
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }

        const site = sites[0];
        console.log('[getWordPressPluginData] Site:', site.name, site.url);

        // Get all installations for this site
        const installations = await base44.asServiceRole.entities.PluginInstallation.filter({ 
            site_id: site.id 
        });

        console.log('[getWordPressPluginData] Found', installations.length, 'installations');

        // Get all plugins to get slugs
        const allPlugins = await base44.asServiceRole.entities.Plugin.list();
        
        // Build map of plugin_id to slug
        const pluginSlugs = {};
        installations.forEach(installation => {
            const plugin = allPlugins.find(p => p.id === installation.plugin_id);
            if (plugin) {
                pluginSlugs[installation.plugin_id] = plugin.slug;
            }
        });

        console.log('[getWordPressPluginData] Plugin slugs:', JSON.stringify(pluginSlugs));

        // Call WordPress REST API to get all plugins
        const wpEndpoint = `${site.url}/wp-json/wp/v2/plugins`;
        console.log('[getWordPressPluginData] Calling WordPress REST API:', wpEndpoint);

        // Create Basic Auth header with username and application password
        const username = site.wp_username || 'admin';
        const authHeader = 'Basic ' + btoa(username + ':' + site.api_key);
        
        console.log('[getWordPressPluginData] Using username:', username);

        const wpResponse = await fetch(wpEndpoint, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            }
        });

        if (!wpResponse.ok) {
            const errorText = await wpResponse.text();
            console.error('[getWordPressPluginData] WordPress API error:', wpResponse.status, errorText);
            return Response.json({ 
                error: 'Failed to connect to WordPress site',
                details: errorText,
                status: wpResponse.status
            }, { status: 502 });
        }

        const wpPlugins = await wpResponse.json();
        console.log('[getWordPressPluginData] WordPress returned', wpPlugins.length, 'plugins');

        // Update each installation based on WordPress data
        let updated = 0;
        for (const installation of installations) {
            const pluginSlug = pluginSlugs[installation.plugin_id];
            if (!pluginSlug) {
                console.log('[getWordPressPluginData] ⚠️ No slug found for plugin:', installation.plugin_id);
                continue;
            }

            // Find plugin in WordPress response
            // The "plugin" field contains: "slug/file.php", we need to match on the slug part
            const wpPlugin = wpPlugins.find(wp => {
                const wpSlug = wp.plugin.split('/')[0];
                return wpSlug === pluginSlug;
            });

            console.log('[getWordPressPluginData] Checking plugin:', pluginSlug);

            if (wpPlugin) {
                // Plugin is installed on WordPress
                const isActive = wpPlugin.status === 'active';
                const version = wpPlugin.version;

                console.log('[getWordPressPluginData] - Found in WordPress');
                console.log('[getWordPressPluginData] - Status:', wpPlugin.status);
                console.log('[getWordPressPluginData] - Version:', version);

                // Determine status
                const newStatus = isActive ? 'active' : 'inactive';

                console.log('[getWordPressPluginData] - Current status:', installation.status);
                console.log('[getWordPressPluginData] - New status:', newStatus);

                await base44.asServiceRole.entities.PluginInstallation.update(installation.id, {
                    installed_version: version,
                    is_active: isActive,
                    status: newStatus,
                    last_sync: new Date().toISOString()
                });

                console.log('[getWordPressPluginData] ✅ Installation updated');
                updated++;
            } else {
                // Plugin is not installed on WordPress
                console.log('[getWordPressPluginData] - Not found in WordPress');
                
                const newStatus = installation.is_enabled ? 'available' : 'unavailable';
                
                console.log('[getWordPressPluginData] - Current status:', installation.status);
                console.log('[getWordPressPluginData] - New status:', newStatus);

                await base44.asServiceRole.entities.PluginInstallation.update(installation.id, {
                    installed_version: null,
                    is_active: false,
                    status: newStatus,
                    last_sync: new Date().toISOString()
                });

                console.log('[getWordPressPluginData] ✅ Installation updated (not installed)');
                updated++;
            }
        }

        // Update site connection status
        await base44.asServiceRole.entities.Site.update(site.id, {
            last_connection: new Date().toISOString(),
            status: 'active'
        });

        console.log('[getWordPressPluginData] === END ===');
        console.log('[getWordPressPluginData] Updated', updated, 'of', installations.length, 'installations');

        return Response.json({ 
            success: true,
            message: 'Plugin data successfully synced from WordPress',
            plugins_synced: updated,
            total_installations: installations.length
        });

    } catch (error) {
        console.error('[getWordPressPluginData] ❌ ERROR:', error.message);
        console.error('[getWordPressPluginData] Stack:', error.stack);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});