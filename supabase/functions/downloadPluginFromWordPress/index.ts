import { authMeWithToken, extractBearerFromReq, uploadToStorage, jsonResponse } from '../_helpers.ts';

Deno.serve(async (req: Request) => {
  try {
    const token = extractBearerFromReq(req);
    const user = await authMeWithToken(token);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { site_id, plugin_slug } = body;
    if (!site_id || !plugin_slug) return jsonResponse({ error: 'Site ID and plugin slug are required' }, 400);

    // Fetch site record from Supabase REST
    const supaUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY');
    const siteRes = await fetch(`${supaUrl}/rest/v1/sites?id=eq.${encodeURIComponent(String(site_id))}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (!siteRes.ok) return jsonResponse({ error: 'Failed to load site' }, 500);
    const sites = await siteRes.json();
    if (!Array.isArray(sites) || sites.length === 0) return jsonResponse({ error: 'Site not found' }, 404);
    const site = sites[0];

    const wpEndpoint = `${site.url.replace(/\/$/, '')}/wp-json/wphub/v1/downloadPlugin`;
    const wpResponse = await fetch(wpEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: site.api_key, plugin_slug })
    });

    if (!wpResponse.ok) {
      const text = await wpResponse.text();
      return jsonResponse({ error: 'Failed to download plugin from WordPress', details: text }, 502);
    }

    const result = await wpResponse.json();
    if (!result.success || !result.zip_base64) return jsonResponse({ error: 'Invalid plugin package from WP' }, 500);

    const zipBase64 = result.zip_base64;
    const zipBytes = Uint8Array.from(atob(zipBase64), c => c.charCodeAt(0));
    const fileName = `${plugin_slug}-v${result.plugin_data?.version || 'unknown'}.zip`;
    const uploadRes = await uploadToStorage(fileName, zipBytes, 'uploads', 'application/zip');

    return jsonResponse({ success: true, plugin_data: result.plugin_data, file_url: uploadRes.file_url });

  } catch (err: any) {
    console.error('downloadPluginFromWordPress error', err);
    return jsonResponse({ error: err.message || String(err) }, 500);
  }
});

export {}; 
