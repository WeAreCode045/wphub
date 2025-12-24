import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';

Deno.serve(async (req: Request) => {
  try {
    const token = extractBearerFromReq(req);
    const user = await authMeWithToken(token);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { site_id, plugin_id } = await req.json();
    if (!site_id || !plugin_id) return jsonResponse({ error: 'Missing required parameters' }, 400);

    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Load site
    const siteRes = await fetch(`${supa}/rest/v1/sites?id=eq.${encodeURIComponent(String(site_id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!siteRes.ok) return jsonResponse({ error: 'Failed to load site' }, 500);
    const sites = await siteRes.json();
    if (!Array.isArray(sites) || sites.length === 0) return jsonResponse({ error: 'Site not found' }, 404);
    const site = sites[0];

    // Load plugin
    const pluginRes = await fetch(`${supa}/rest/v1/plugins?id=eq.${encodeURIComponent(String(plugin_id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!pluginRes.ok) return jsonResponse({ error: 'Failed to load plugin' }, 500);
    const plugins = await pluginRes.json();
    if (!Array.isArray(plugins) || plugins.length === 0) return jsonResponse({ error: 'Plugin not found' }, 404);
    const plugin = plugins[0];

    // Call connector endpoint
    const connectorUrl = `${site.url.replace(/\/$/, '')}/wp-json/wphub/v1/activatePlugin`;
    const response = await fetch(connectorUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key, plugin_slug: plugin.slug }) });
    if (!response.ok) {
      const errorText = await response.text().catch(()=>'');
      return jsonResponse({ success: false, error: `Connector error: ${response.status} - ${errorText}` }, 500);
    }
    const result = await response.json();

    if (result.success) {
      const currentPlugins = site.plugins || [];
      const idx = currentPlugins.findIndex((p:any)=>p.plugin_id === plugin_id);
      if (idx >= 0) {
        currentPlugins[idx].is_activated = 1;
      }
      await fetch(`${supa}/rest/v1/sites?id=eq.${encodeURIComponent(String(site_id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ plugins: currentPlugins, connection_checked_at: new Date().toISOString() }) });
    }

    return jsonResponse({ success: result.success, message: result.message });
  } catch (err:any) {
    console.error('activatePlugin error', err);
    return jsonResponse({ success: false, error: err.message || String(err) }, 500);
  }
});

export {};
