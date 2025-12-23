import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { api_key } = await req.json();

        console.log('[getPluginCommands] === START ===');
        console.log('[getPluginCommands] Received API key:', api_key ? 'YES' : 'NO');

        if (!api_key) {
            return Response.json({ error: 'API key is required' }, { status: 401 });
        }

        // Find site by API key
        const sites = await base44.asServiceRole.entities.Site.filter({ api_key });
        
        console.log('[getPluginCommands] Sites found:', sites.length);
        
        if (sites.length === 0) {
            return Response.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const site = sites[0];
        console.log('[getPluginCommands] Site:', site.name, '(ID:', site.id, ')');

        // Get all plugin installations for this site
        const allInstallations = await base44.asServiceRole.entities.PluginInstallation.filter({ 
            site_id: site.id
        });

        console.log('[getPluginCommands] Found', allInstallations.length, 'total installations');
        
        // Get all plugins
        const allPlugins = await base44.asServiceRole.entities.Plugin.list();
        console.log('[getPluginCommands] Total plugins in system:', allPlugins.length);
        
        // Get all versions
        const allVersions = await base44.asServiceRole.entities.PluginVersion.list();
        console.log('[getPluginCommands] Total versions in system:', allVersions.length);

        const commands = [];

        for (const installation of allInstallations) {
            const plugin = allPlugins.find(p => p.id === installation.plugin_id);
            const version = allVersions.find(v => v.id === installation.version_id);

            console.log('[getPluginCommands] Processing installation', installation.id);
            console.log('[getPluginCommands]   - Plugin found:', plugin ? plugin.name : 'NOT FOUND');
            console.log('[getPluginCommands]   - Version found:', version ? version.version : 'NOT FOUND');
            console.log('[getPluginCommands]   - Status:', installation.status);
            console.log('[getPluginCommands]   - is_enabled:', installation.is_enabled);
            console.log('[getPluginCommands]   - installed_version:', installation.installed_version);
            console.log('[getPluginCommands]   - is_active:', installation.is_active);

            if (!plugin || !version) {
                console.log('[getPluginCommands] ❌ Skipping - plugin or version not found');
                continue;
            }

            let action = null;
            
            // SCENARIO 1: Plugin moet gedeïnstalleerd worden (was geïnstalleerd maar is nu unavailable)
            if (!installation.is_enabled && installation.installed_version) {
                action = 'uninstall';
                console.log('[getPluginCommands] ✅ Action: UNINSTALL (unavailable but still installed)');
            }
            // SCENARIO 2: Status is pending en plugin is nog niet geïnstalleerd -> INSTALL
            else if (installation.status === 'pending' && !installation.installed_version) {
                action = 'install';
                console.log('[getPluginCommands] ✅ Action: INSTALL (pending + not installed)');
            }
            // SCENARIO 3: Status is pending en versie is veranderd -> UPDATE
            else if (installation.status === 'pending' && installation.installed_version && installation.installed_version !== version.version) {
                action = 'update';
                console.log('[getPluginCommands] ✅ Action: UPDATE (version mismatch)');
            }
            // SCENARIO 4: Plugin is geïnstalleerd, moet geactiveerd worden
            else if (installation.status === 'pending' && installation.installed_version && installation.is_active === true) {
                action = 'activate';
                console.log('[getPluginCommands] ✅ Action: ACTIVATE (should be active)');
            }
            // SCENARIO 5: Plugin is geïnstalleerd, moet gedeactiveerd worden
            else if (installation.status === 'pending' && installation.installed_version && installation.is_active === false) {
                action = 'deactivate';
                console.log('[getPluginCommands] ✅ Action: DEACTIVATE (should be inactive)');
            }
            else {
                console.log('[getPluginCommands] ⏭️  No action needed');
            }

            if (action) {
                const command = {
                    installation_id: installation.id,
                    plugin_id: plugin.id,
                    plugin_slug: plugin.slug,
                    plugin_name: plugin.name,
                    action: action,
                    version: version.version,
                    file_url: version.file_url
                };
                commands.push(command);
                console.log('[getPluginCommands] 📦 Command added:', JSON.stringify(command));
            }
        }

        console.log('[getPluginCommands] === RESULT ===');
        console.log('[getPluginCommands] Total commands:', commands.length);
        console.log('[getPluginCommands] === END ===');

        return Response.json({ 
            success: true,
            commands: commands,
            debug: {
                site_id: site.id,
                site_name: site.name,
                total_installations: allInstallations.length,
                total_commands: commands.length
            }
        });

    } catch (error) {
        console.error('[getPluginCommands] ❌ ERROR:', error.message);
        console.error('[getPluginCommands] Stack:', error.stack);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});