import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id } = await req.json();

        console.log('[updateSiteData] === START ===');
        console.log('[updateSiteData] Site ID:', site_id);

        if (!site_id) {
            return Response.json({ error: 'Missing site_id' }, { status: 400 });
        }

        // Get site details
        const sites = await base44.entities.Site.filter({ id: site_id });
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }
        const site = sites[0];

        console.log('[updateSiteData] Site:', site.name);

        // Call connector endpoint to get WP version
        const connectorUrl = `${site.url}/wp-json/wphub/v1/getWordPressVersion`;
        console.log('[updateSiteData] Calling connector:', connectorUrl);

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
            const errorText = await response.text();
            console.error('[updateSiteData] Connector error:', errorText);
            return Response.json({ 
                success: false,
                error: `Connector error: ${response.status} - ${errorText}` 
            }, { status: 500 });
        }

        const result = await response.json();
        console.log('[updateSiteData] Connector response:', result);

        if (result.success) {
            await base44.entities.Site.update(site_id, {
                wp_version: result.wp_version,
                connection_checked_at: new Date().toISOString(),
                status: 'active'
            });

            console.log('[updateSiteData] ✅ Success - WordPress version updated to', result.wp_version);
        }

        console.log('[updateSiteData] === END ===');

        return Response.json({
            success: result.success,
            wp_version: result.wp_version,
            message: result.message
        });

    } catch (error) {
        console.error('[updateSiteData] ❌ ERROR:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});