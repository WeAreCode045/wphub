import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { SearchWordPressThemesRequestSchema, z } from '../_shared/schemas.ts';

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

    // Parse and validate request body with Zod
    let body;
    try {
      const bodyText = await req.text();
      const parsed = JSON.parse(bodyText);
      body = SearchWordPressThemesRequestSchema.parse(parsed);
    } catch (parseError) {
      console.error('[searchWordPressThemes] Validation error:', parseError);
      const error = parseError instanceof z.ZodError
        ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        : `Invalid request: ${parseError.message}`;
      return new Response(
        JSON.stringify({ error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { search, page = 1, per_page = 20 } = body;

    if (!search) {
      return new Response(
        JSON.stringify({ success: false, error: 'Search query is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = `https://api.wordpress.org/themes/info/1.2/?action=query_themes&request[search]=${encodeURIComponent(search)}&request[page]=${page}&request[per_page]=${per_page}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
        success: false, 
        error: 'Failed to search WordPress themes' 
      }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    const themes = (data.themes || []).map(theme => ({
      name: theme.name,
      slug: theme.slug,
      version: theme.version,
      description: theme.description ? theme.description.replace(/<[^>]*>/g, '').substring(0, 200) : '',
      author: theme.author?.display_name || theme.author?.user_nicename || '',
      author_profile: theme.author?.profile || '',
      screenshot_url: theme.screenshot_url || '',
      preview_url: theme.preview_url || '',
      homepage: theme.homepage || `https://wordpress.org/themes/${theme.slug}/`,
      download_link: theme.download_link || `https://downloads.wordpress.org/theme/${theme.slug}.${theme.version}.zip`,
      download_url: theme.download_link || `https://downloads.wordpress.org/theme/${theme.slug}.${theme.version}.zip`,
      active_installs: theme.active_installs || 0,
      rating: theme.rating || 0,
      num_ratings: theme.num_ratings || 0,
      last_updated: theme.last_updated || ''
    }));

    return new Response(
        JSON.stringify({
      success: true,
      themes,
      info: {
        page: data.info?.page || page,
        pages: data.info?.pages || 1,
        results: data.info?.results || themes.length
      }
    }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

  } catch (error) {
    console.error('Search WordPress themes error:', error);
    return new Response(
        JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to search themes' 
    }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});
