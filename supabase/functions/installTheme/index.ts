import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { InstallThemeRequestSchema, z } from '../_shared/schemas.ts';

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
      body = InstallThemeRequestSchema.parse(parsed);
    } catch (parseError) {
      console.error('[installTheme] Validation error:', parseError);
      const error = parseError instanceof z.ZodError
        ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        : `Invalid request: ${parseError.message}`;
      return new Response(
        JSON.stringify({ error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { site_id, theme_slug, theme_id, download_url } = body;

    console.log('[installTheme] === START ===');
    console.log('[installTheme] Site ID:', site_id);
    console.log('[installTheme] Theme slug:', theme_slug);
    console.log('[installTheme] Theme ID:', theme_id);
    console.log('[installTheme] Download URL:', download_url);

    // Get site details
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select()
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      console.error('[installTheme] Site not found:', siteError);
      return new Response(
        JSON.stringify({ success: false, error: 'Site not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[installTheme] Site:', site.name);

    // Determine download URL
    let themeDownloadUrl = download_url;

    // If no download URL provided and theme_id exists, try to get it from library
    if (!themeDownloadUrl && theme_id) {
      const { data: theme } = await supabase
        .from('themes')
        .select('file_url, versions(file_url)')
        .eq('id', theme_id)
        .single();

      if (theme?.file_url) {
        themeDownloadUrl = theme.file_url;
      } else if (theme?.versions && theme.versions.length > 0) {
        themeDownloadUrl = theme.versions[0].file_url;
      }
    }

    // If still no download URL, try WordPress.org
    if (!themeDownloadUrl) {
      // For WordPress.org themes, construct the download URL
      themeDownloadUrl = `https://downloads.wordpress.org/theme/${theme_slug}.latest-stable.zip`;
      console.log('[installTheme] Using WordPress.org URL:', themeDownloadUrl);
    }

    // Call WordPress connector to download and install theme
    const connectorUrl = `${site.url}/wp-json/wphub/v1/downloadTheme`;
    console.log('[installTheme] Calling connector:', connectorUrl);

    const response = await fetch(connectorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: site.api_key,
        file_url: themeDownloadUrl,
        theme_slug: theme_slug,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[installTheme] Connector error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Connector error: ${response.status} - ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('[installTheme] Connector response:', result);

    if (!result.success) {
      console.log('[installTheme] Installation failed:', result.message);
      return new Response(
        JSON.stringify({ success: false, error: result.message || 'Installation failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update theme installed_on if theme_id provided
    if (theme_id) {
      try {
        const { data: theme } = await supabase
          .from('themes')
          .select('installed_on')
          .eq('id', theme_id)
          .single();

        if (theme) {
          const installedOn = theme.installed_on || [];
          const existingEntry = installedOn.find(entry => entry.site_id === site_id);
          
          if (!existingEntry) {
            installedOn.push({
              site_id: site_id,
              installed_at: new Date().toISOString(),
            });

            await supabase
              .from('themes')
              .update({ installed_on: installedOn })
              .eq('id', theme_id);
          }
        }
      } catch (err) {
        console.error('[installTheme] Failed to update installed_on:', err);
      }
    }

    // Log activity
    await supabase.from('activitylogs').insert({
      user_email: user.email,
      action: `Theme geïnstalleerd op ${site.name}`,
      entity_type: 'site',
      entity_id: site_id,
      details: theme_slug,
    });

    console.log('[installTheme] === SUCCESS ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Theme installed successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[installTheme] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
