import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Support both POST (JSON body) and GET (query params) to avoid 405 on production invoke
        let search: string | undefined;
        let page = 1;
        let per_page = 20;

        if (req.method === 'GET') {
            const url = new URL(req.url);
            search = url.searchParams.get('search') || undefined;
            page = parseInt(url.searchParams.get('page') || '1', 10) || 1;
            per_page = parseInt(url.searchParams.get('per_page') || '20', 10) || 20;
        } else {
            const body = await req.json().catch(() => ({}));
            search = body.search;
            page = body.page || 1;
            per_page = body.per_page || 20;
        }

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

        const plugins = data.plugins?.map((plugin: any) => ({
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

        return new Response(JSON.stringify({ success: true, info: data.info, plugins }), { headers: { 'content-type': 'application/json' } });

    } catch (error: any) {
        console.error('[searchWordPressPlugins] ❌ ERROR:', error?.message || error);
        return new Response(JSON.stringify({ error: (error?.message || String(error)) }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
});
