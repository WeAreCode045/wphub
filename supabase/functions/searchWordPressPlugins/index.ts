import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { SearchWordPressPluginsRequestSchema, z } from '../_shared/schemas.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
    try {
        const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Parse request parameters from URL query or body
        let search: string | undefined;
        let page = 1;
        let per_page = 20;

        // First, try to extract from query parameters
        const url = new URL(req.url);
        const querySearch = url.searchParams.get('search');
        const queryPage = url.searchParams.get('page');
        const queryPerPage = url.searchParams.get('per_page');

        console.log('[searchWordPressPlugins] Query params:', { querySearch, queryPage, queryPerPage });

        if (querySearch) {
            // Parameters found in query string
            search = querySearch;
            page = queryPage ? parseInt(queryPage, 10) : 1;
            per_page = queryPerPage ? parseInt(queryPerPage, 10) : 20;
            console.log('[searchWordPressPlugins] Using query parameters:', { search, page, per_page });
        } else {
            // Try to parse from body
            let parsed: any = {};
            try {
                const bodyText = await req.text();
                console.log('[searchWordPressPlugins] Body text:', bodyText);
                
                if (bodyText && bodyText.trim() !== '' && bodyText !== '[object Object]') {
                    parsed = JSON.parse(bodyText);
                    console.log('[searchWordPressPlugins] Parsed body:', parsed);
                }
            } catch (parseError) {
                console.error('[searchWordPressPlugins] Parse error:', parseError.message);
                // Continue - we'll validate below
            }

            try {
                const validated = SearchWordPressPluginsRequestSchema.parse(parsed);
                search = validated.search;
                page = validated.page || 1;
                per_page = validated.per_page || 20;
                console.log('[searchWordPressPlugins] Using body parameters:', { search, page, per_page });
            } catch (validateError) {
                console.error('[searchWordPressPlugins] Validation error:', validateError);
                const error = validateError instanceof z.ZodError
                    ? `Validation error: ${validateError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                    : `Validation failed: ${validateError.message}`;
                return new Response(
                    JSON.stringify({ success: false, error }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        if (!search) {
            return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
            screenshot_url: plugin.icons?.['2x'] || plugin.icons?.['1x'] || plugin.banners?.['2x'] || plugin.banners?.['1x'] || '',
            active_installs: plugin.active_installs,
            rating: plugin.rating,
            num_ratings: plugin.num_ratings,
            last_updated: plugin.last_updated
        })) || [];

        console.log('[searchWordPressPlugins] === END ===');

        return new Response(JSON.stringify({ success: true, info: data.info, plugins }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });

    } catch (error: any) {
        console.error('[searchWordPressPlugins] ❌ ERROR:', error?.message || error);
        return new Response(JSON.stringify({ success: false, error: (error?.message || String(error)) }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
});
