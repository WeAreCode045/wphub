import { createClient } from 'jsr:@supabase/supabase-js@2'


Deno.serve(async (req) => {
  try {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { site_id } = await req.json();

    if (!site_id) {
      return Response.json({ success: false, error: 'site_id is required' });
    }

    const { data: site, error: siteError } = await supabase.from('sites').select().eq('id', site_id).single();

    if (!site) {
      return Response.json({ success: false, error: 'Site not found' });
    }

    const response = await fetch(`${site.url}/wp-json/wphub/v1/listThemes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key }) });

    const data = await response.json();

    if (data.success) {
      return Response.json({ success: true, themes: data.themes || [], total: data.total || 0, active_theme: data.active_theme });
    } else {
      return Response.json({ success: false, error: data.message || 'Failed to list themes', themes: [] });
    }
  } catch (error) {
    return Response.json({ success: false, error: error.message, themes: [] });
  }
});