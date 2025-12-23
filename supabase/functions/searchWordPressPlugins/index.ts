import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { search, page = 1, per_page = 20 } = await req.json();

        if (!search) {
            return Response.json({ error: 'Search query is required' }, { status: 400 });
        }

        console.log('[searchWordPressPlugins] === START ===');
        console.log('[searchWordPressPlugins] Search:', search);
        console.log('[searchWordPressPlugins] Page:', page);

        const wpApiUrl = `https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&request[search]=${encodeURIComponent(search)}&request[page]=${page}&request[per_page]=${per_page}`;
        console.log('[searchWordPressPlugins] Calling WP API:', wpApiUrl);

        const response = await fetch(wpApiUrl);
        if (!response.ok) throw new Error(`WordPress API returned ${response.status}`);

        const data = await response.json();

        const plugins = data.plugins?.map(plugin => ({
            name: plugin.name,
            slug: plugin.slug,
            version: plugin.version,
            description: plugin.short_description,
            author: plugin.author?.replace(/<[^>]*>/g, ''),
            download_url: plugin.download_link,
            active_installs: plugin.active_installs,
            rating: plugin.rating,
            num_ratings: plugin.num_ratings,
            last_updated: plugin.last_updated
        })) || [];

        console.log('[searchWordPressPlugins] === END ===');

        return Response.json({
            success: true,
            info: data.info,
            plugins: plugins
        });

    } catch (error) {
        console.error('[searchWordPressPlugins] ❌ ERROR:', error.message);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});
