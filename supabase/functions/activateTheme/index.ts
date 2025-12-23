import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';

Deno.serve(async (req: Request) => {
  try {
    const token = extractBearerFromReq(req);
    const user = await authMeWithToken(token);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { site_id, theme_slug } = await req.json();
    if (!site_id || !theme_slug) return jsonResponse({ success: false, error: 'site_id and theme_slug are required' }, 400);

    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY');

    const siteRes = await fetch(`${supa}/rest/v1/sites?id=eq.${encodeURIComponent(String(site_id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!siteRes.ok) return jsonResponse({ success: false, error: 'Site not found' }, 404);
    const site = (await siteRes.json())?.[0];
    if (!site) return jsonResponse({ success: false, error: 'Site not found' }, 404);

    const connectorRes = await fetch(`${site.url.replace(/\/$/, '')}/wp-json/wphub/v1/activateTheme`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key, theme_slug }) });
    const data = await connectorRes.json();

    if (data.success) {
      // Update themes installed_on statuses
      const themesRes = await fetch(`${supa}/rest/v1/themes`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      const allThemes = await themesRes.json();

      for (const theme of (allThemes||[])) {
        const installedOn = theme.installed_on || [];
        let updated = false;
        const updatedInstalledOn = installedOn.map((install:any) => {
          if (install.site_id === site_id) {
            updated = true;
            return { ...install, is_active: theme.slug === theme_slug };
          }
          return install;
        });
        if (updated) {
          await fetch(`${supa}/rest/v1/themes?id=eq.${encodeURIComponent(String(theme.id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ installed_on: updatedInstalledOn }) });
        }
      }

      await fetch(`${supa}/rest/v1/activity_logs`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_email: user.email, action: `Theme geactiveerd op ${site.name}`, entity_type: 'site', entity_id: site_id, details: theme_slug }) });

      return jsonResponse({ success: true, message: 'Theme activated successfully', active_theme: data.active_theme });
    }

    return jsonResponse({ success: false, error: data.message || 'Failed to activate theme' }, 500);
  } catch (err:any) {
    console.error('activateTheme error', err);
    return jsonResponse({ success: false, error: err.message || String(err) }, 500);
  }
});

export {};
