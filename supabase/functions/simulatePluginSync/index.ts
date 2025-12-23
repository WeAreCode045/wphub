import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { site_id } = await req.json();

        console.log(`[simulatePluginSync] Triggered for site_id: ${site_id}`);

        if (!site_id) {
            return Response.json({ error: 'Site ID is required' }, { status: 400 });
        }

        // Get site details
        const sites = await base44.asServiceRole.entities.Site.filter({ id: site_id });
        
        if (sites.length === 0) {
            console.log(`[simulatePluginSync] Site not found: ${site_id}`);
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }

        const site = sites[0];
        console.log(`[simulatePluginSync] Site found: ${site.name} (${site.url})`);

        // Try to trigger sync on WordPress site via REST API
        try {
            const wpSyncUrl = `${site.url}/wp-json/wphub/v1/sync`;
            console.log(`[simulatePluginSync] Calling WordPress sync endpoint: ${wpSyncUrl}`);
            
            const response = await fetch(wpSyncUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: site.api_key,
                    trigger: 'platform'
                })
            });

            const responseText = await response.text();
            console.log(`[simulatePluginSync] WordPress response status: ${response.status}`);
            console.log(`[simulatePluginSync] WordPress response body:`, responseText);

            if (response.ok) {
                return Response.json({ 
                    success: true,
                    message: 'Sync triggered successfully on WordPress site',
                    site_name: site.name,
                    wp_response: responseText
                });
            } else {
                console.log(`[simulatePluginSync] WordPress sync failed, will sync on next cron`);
                return Response.json({ 
                    success: true,
                    message: 'Sync will be executed on next scheduled check',
                    site_name: site.name,
                    note: 'Direct trigger not available, changes marked as pending',
                    wp_status: response.status,
                    wp_response: responseText
                });
            }
        } catch (wpError) {
            console.error(`[simulatePluginSync] WordPress connection error:`, wpError);
            return Response.json({ 
                success: true,
                message: 'Changes marked as pending, will sync on next scheduled check',
                site_name: site.name,
                error: wpError.message
            });
        }

    } catch (error) {
        console.error('[simulatePluginSync] Error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});