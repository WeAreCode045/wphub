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
      return Response.json({ success: false, error: 'Search query is required' });
    }

    const apiUrl = `https://api.wordpress.org/themes/info/1.2/?action=query_themes&request[search]=${encodeURIComponent(search)}&request[page]=${page}&request[per_page]=${per_page}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return Response.json({ 
        success: false, 
        error: 'Failed to search WordPress themes' 
      });
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
      download_url: theme.download_link || `https://downloads.wordpress.org/theme/${theme.slug}.${theme.version}.zip`,
      active_installs: theme.active_installs || 0,
      rating: theme.rating || 0,
      num_ratings: theme.num_ratings || 0,
      last_updated: theme.last_updated || ''
    }));

    return Response.json({
      success: true,
      themes,
      info: {
        page: data.info?.page || page,
        pages: data.info?.pages || 1,
        results: data.info?.results || themes.length
      }
    });

  } catch (error) {
    console.error('Search WordPress themes error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Failed to search themes' 
    });
  }
});
