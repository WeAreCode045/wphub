import { createClientFromRequest } from '../supabaseClientServer.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await User.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { site_id, theme_slug, theme_id } = await req.json();

    if (!site_id || !theme_slug) {
      return Response.json({ success: false, error: 'site_id and theme_slug are required' });
    }

    const site = await entities.Site.get(site_id);

    if (!site) {
      return Response.json({ success: false, error: 'Site not found' });
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
        const theme = await entities.Theme.get(theme_id);
        if (theme) {
          const installedOn = theme.installed_on || [];
          const updatedInstalledOn = installedOn.filter(i => i.site_id !== site_id);
          await entities.Theme.update(theme_id, {
            installed_on: updatedInstalledOn
          });
        }
      }

      await entities.ActivityLog.create({
        user_email: user.email,
        action: `Theme verwijderd van ${site.name}`,
        entity_type: 'site',
        entity_id: site_id,
        details: theme_slug
      });

      return Response.json({
        success: true,
        message: 'Theme uninstalled successfully'
      });
    } else {
      return Response.json({
        success: false,
        error: data.message || 'Failed to uninstall theme'
      });
    }
  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});
