import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';


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

    const { site_id, theme_slug, theme_id } = await req.json();

    if (!site_id || !theme_slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'site_id and theme_slug are required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: site, error: siteError } = await supabase.from('sites').select().eq('id', site_id).single();

    if (!site) {
      return new Response(
        JSON.stringify({ success: false, error: 'Site not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(`${site.url}/wp-json/wphub/v1/uninstallTheme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: site.api_key,
        theme_slug: theme_slug
      })
    });

    const data = await response.json();

    if (data.success) {
      if (theme_id) {
        const { data: theme, error: themeError } = await supabase.from('themes').select().eq('id', theme_id).single();
        if (theme) {
          const installedOn = theme.installed_on || [];
          const updatedInstalledOn = installedOn.filter(i => i.site_id !== site_id);
          await supabase.from('themes').update({
            installed_on: updatedInstalledOn
          });
        }
      }

      await supabase.from('activitylogs').insert({
        user_email: user.email,
        action: `Theme verwijderd van ${site.name}`,
        entity_type: 'site',
        entity_id: site_id,
        details: theme_slug
      });

      return new Response(
        JSON.stringify({
        success: true,
        message: 'Theme uninstalled successfully'
      }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
        success: false,
        error: data.message || 'Failed to uninstall theme'
      }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});
