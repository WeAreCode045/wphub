import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authMeWithToken, extractBearerFromReq, uploadToStorage, jsonResponse } from '../_helpers.ts';
import { corsHeaders } from '../_helpers.ts';
import { DownloadPluginFromWordPressRequestSchema, z } from '../_shared/schemas.ts';

Deno.serve(async (req: Request) => {
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
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    // Parse and validate request body with Zod
    let body;
    try {
      const bodyText = await req.text();
      const parsed = JSON.parse(bodyText);
      body = DownloadPluginFromWordPressRequestSchema.parse(parsed);
    } catch (parseError) {
      console.error('[downloadPluginFromWordPress] Validation error:', parseError);
      const error = parseError instanceof z.ZodError
        ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        : `Invalid request: ${parseError.message}`;
      return jsonResponse({ error }, 400);
    }

    const { slug, version } = body;
    // Note: Original code had site_id and plugin_slug but schema uses slug
    const site_id = body.site_id || (parsed as any).site_id;
    const plugin_slug = slug;

    // Fetch site record from Supabase REST
    const supaUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
