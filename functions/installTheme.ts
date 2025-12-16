import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { site_id, theme_id, download_url } = await req.json();

    if (!site_id || !download_url) {
      return Response.json({ success: false, error: 'site_id and download_url are required' });
    }

    const site = await base44.entities.Site.get(site_id);

    if (!site) {
      return Response.json({ success: false, error: 'Site not found' });
    }

    // Get theme info if theme_id is provided
    let theme = null;
    let themeSlug = null;
    
    if (theme_id) {
      theme = await base44.entities.Theme.get(theme_id);
      themeSlug = theme?.slug;
    }

    let data;
    try {
      const response = await fetch(`${site.url}/wp-json/wphub/v1/installTheme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: site.api_key,
          file_url: download_url,
          theme_slug: themeSlug
        })
      });

      if (!response.ok) {
        const text = await response.text();
        return Response.json({
          success: false,
          error: `WordPress API error (${response.status}): ${text.substring(0, 200)}`
        });
      }

      data = await response.json();
    } catch (fetchError) {
      return Response.json({
        success: false,
        error: `Failed to connect to WordPress site: ${fetchError.message}`
      });
    }

    if (data.success) {
      // Update theme's installed_on if theme_id was provided
      if (theme_id && theme) {
        const installedOn = theme.installed_on || [];
        const latestVersion = theme.latest_version || theme.versions?.[theme.versions.length - 1]?.version;
        
        if (!installedOn.some(i => i.site_id === site_id)) {
          installedOn.push({
            site_id: site_id,
            version: latestVersion,
            is_active: false
          });
          
          await base44.entities.Theme.update(theme_id, {
            installed_on: installedOn
          });
        }
      }

      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: `Theme geïnstalleerd op ${site.name}`,
        entity_type: 'site',
        entity_id: site_id,
        details: themeSlug || 'WordPress theme'
      });

      return Response.json({
        success: true,
        message: 'Theme installed successfully'
      });
    } else {
      return Response.json({
        success: false,
        error: data.message || 'Failed to install theme'
      });
    }
  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});