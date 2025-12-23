import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id, wp_debug, wp_debug_log, wp_debug_display } = await req.json();

        console.log('[updateDebugSettings] Site ID:', site_id);
        console.log('[updateDebugSettings] Settings:', { wp_debug, wp_debug_log, wp_debug_display });

        if (!site_id) {
            return Response.json({ error: 'Site ID is required' }, { status: 400 });
        }

        const sites = await base44.entities.Site.filter({ id: site_id });
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }
        const site = sites[0];

        const connectorUrl = `${site.url}/wp-json/wphub/v1/updateDebugSettings`;
        const response = await fetch(connectorUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: site.api_key,
                wp_debug: wp_debug,
                wp_debug_log: wp_debug_log,
                wp_debug_display: wp_debug_display
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[updateDebugSettings] Connector error:', errorText);
            return Response.json({ 
                success: false,
                error: `Failed to update debug settings: ${errorText}` 
            }, { status: 500 });
        }

        const result = await response.json();
        console.log('[updateDebugSettings] Result:', result);

        const healthCheck = site.health_check || {};
        healthCheck.debug_settings = {
            wp_debug: wp_debug,
            wp_debug_log: wp_debug_log,
            wp_debug_display: wp_debug_display
        };

        await base44.entities.Site.update(site_id, {
            health_check: healthCheck
        });

        await base44.entities.ActivityLog.create({
            user_email: user.email,
            action: `Debug instellingen bijgewerkt voor site: ${site.name}`,
            entity_type: 'site',
            entity_id: site_id,
            details: `WP_DEBUG: ${wp_debug}, WP_DEBUG_LOG: ${wp_debug_log}, WP_DEBUG_DISPLAY: ${wp_debug_display}`
        });

        return Response.json({
            success: true,
            message: 'Debug settings updated successfully'
        });

    } catch (error) {
        console.error('[updateDebugSettings] Error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});
