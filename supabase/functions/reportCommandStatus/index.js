import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { api_key, installation_id, status, error_message, version } = await req.json();

        console.log(`[reportCommandStatus] Received: installation_id=${installation_id}, status=${status}, version=${version}`);
        console.log(`[reportCommandStatus] Error message:`, error_message);

        if (!api_key) {
            return Response.json({ error: 'API key is required' }, { status: 401 });
        }

        // Verify API key
        const sites = await base44.asServiceRole.entities.Site.filter({ api_key });
        
        if (sites.length === 0) {
            console.log(`[reportCommandStatus] Invalid API key`);
            return Response.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const site = sites[0];
        console.log(`[reportCommandStatus] Site: ${site.name}`);

        // Build update data based on status
        const updateData = {
            last_sync: new Date().toISOString()
        };

        // Map WordPress status to our status enum
        switch (status) {
            case 'installed':
                updateData.status = 'installed';
                updateData.installed_version = version;
                updateData.is_active = false;
                console.log(`[reportCommandStatus] Plugin installed successfully`);
                break;
                
            case 'active':
                updateData.status = 'active';
                updateData.installed_version = version;
                updateData.is_active = true;
                console.log(`[reportCommandStatus] Plugin activated successfully`);
                break;
                
            case 'inactive':
                updateData.status = 'inactive';
                updateData.is_active = false;
                // Keep installed_version as is
                console.log(`[reportCommandStatus] Plugin deactivated successfully`);
                break;
                
            case 'uninstalled':
                updateData.status = 'available';
                updateData.installed_version = null;
                updateData.is_active = false;
                updateData.is_enabled = true;
                console.log(`[reportCommandStatus] Plugin uninstalled, back to available`);
                break;
                
            case 'error':
                updateData.status = 'error';
                updateData.installed_version = null;
                updateData.is_active = false;
                console.log(`[reportCommandStatus] Error status - clearing installation`);
                break;
                
            default:
                updateData.status = status;
                console.log(`[reportCommandStatus] Unknown status: ${status}`);
        }

        console.log(`[reportCommandStatus] Updating installation ${installation_id} with:`, updateData);

        await base44.asServiceRole.entities.PluginInstallation.update(installation_id, updateData);

        // Log activity
        const installation = await base44.asServiceRole.entities.PluginInstallation.filter({ id: installation_id });
        if (installation.length > 0) {
            const plugins = await base44.asServiceRole.entities.Plugin.list();
            const plugin = plugins.find(p => p.id === installation[0].plugin_id);
            
            if (plugin) {
                let action;
                switch (status) {
                    case 'installed':
                        action = `Plugin geïnstalleerd op ${site.name}: ${plugin.name}`;
                        break;
                    case 'active':
                        action = `Plugin geactiveerd op ${site.name}: ${plugin.name}`;
                        break;
                    case 'inactive':
                        action = `Plugin gedeactiveerd op ${site.name}: ${plugin.name}`;
                        break;
                    case 'uninstalled':
                        action = `Plugin gedeïnstalleerd op ${site.name}: ${plugin.name}`;
                        break;
                    case 'error':
                        action = `Plugin actie MISLUKT op ${site.name}: ${plugin.name}`;
                        break;
                    default:
                        action = `Plugin ${status} op ${site.name}: ${plugin.name}`;
                }
                
                await base44.asServiceRole.entities.ActivityLog.create({
                    user_email: 'system',
                    action: action,
                    entity_type: 'installation',
                    entity_id: installation_id,
                    details: error_message || `Status: ${status}, Version: ${version || 'N/A'}`
                });
            }
        }

        console.log(`[reportCommandStatus] Successfully updated installation ${installation_id}`);

        return Response.json({ 
            success: true,
            message: 'Status updated successfully'
        });

    } catch (error) {
        console.error('[reportCommandStatus] Error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});