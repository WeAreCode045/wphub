import { createClientFromRequest } from '../base44Shim.js';

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

        // Call WordPress REST API to get all plugins using connector endpoint
        const wpEndpoint = `${site.url}/wp-json/wphub/v1/getInstalledPlugins`;
        console.log('[getWordPressPluginData] Calling WordPress connector:', wpEndpoint);

        const wpResponse = await fetch(wpEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: site.api_key
            })
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

        const result = await wpResponse.json();
        console.log('[getWordPressPluginData] WordPress returned', result.plugins?.length || 0, 'plugins');

        if (!result.success || !result.plugins) {
            return Response.json({ 
                error: 'Failed to get plugins from WordPress',
                details: result.message || 'Unknown error'
            }, { status: 500 });
        }

        // Format plugins data
        const plugins = result.plugins.map(plugin => ({
            name: plugin.name,
            slug: plugin.slug,
            version: plugin.version,
            description: plugin.description || '',
            is_active: plugin.is_active || false
        }));

        console.log('[getWordPressPluginData] === END ===');
        console.log('[getWordPressPluginData] Returning', plugins.length, 'plugins');

        return Response.json({ 
            success: true,
            plugins: plugins,
            total: plugins.length
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