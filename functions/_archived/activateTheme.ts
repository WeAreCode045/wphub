import { createClientFromRequest } from './base44Shim.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { site_id, theme_slug } = await req.json();

    if (!site_id || !theme_slug) {
      return Response.json({ success: false, error: 'site_id and theme_slug are required' });
    }

    const site = await base44.entities.Site.get(site_id);

    if (!site) {
      return Response.json({ success: false, error: 'Site not found' });
    }

    const response = await fetch(`${site.url}/wp-json/wphub/v1/activateTheme`, {
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
      // Update theme's installed_on to mark as active
      const allThemes = await base44.entities.Theme.list();
      
      for (const theme of allThemes) {
        const installedOn = theme.installed_on || [];
        let updated = false;
        
        const updatedInstalledOn = installedOn.map(install => {
          if (install.site_id === site_id) {
            updated = true;
            return {
              ...install,
              is_active: theme.slug === theme_slug
            };
          }
          return install;
        });
        
        if (updated) {
          await base44.entities.Theme.update(theme.id, {
            installed_on: updatedInstalledOn
          });
        }
      }

      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: `Theme geactiveerd op ${site.name}`,
        entity_type: 'site',
        entity_id: site_id,
        details: theme_slug
      });

      return Response.json({
        success: true,
        message: 'Theme activated successfully',
        active_theme: data.active_theme
      });
    } else {
      return Response.json({
        success: false,
        error: data.message || 'Failed to activate theme'
      });
    }
  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});