import JSZip from 'npm:jszip@3.10.1';
import { authMeWithToken, extractBearerFromReq, uploadToStorage, jsonResponse } from '../_helpers.ts';

function generateConnectorPluginCode(apiKey: string, hubUrl: string, version: string) {
  return `<?php
/**
 * Plugin Name: WP Plugin Hub Connector
 * Version: ${version}
 */
// Minimal connector placeholder
`;
}

Deno.serve(async (req: Request) => {
  try {
    const token = extractBearerFromReq(req);
    const user = await authMeWithToken(token);
    if (!user || user.role !== 'admin') return jsonResponse({ error: 'Unauthorized - Admin required' }, 403);

    const { api_key, hub_url, version, description, custom_code } = await req.json();
    if (!version) return jsonResponse({ error: 'Version is required' }, 400);

    let pluginCode = '';
    if (custom_code) {
      pluginCode = custom_code.replace(/\{\{API_KEY\}\}/g, api_key || '{{API_KEY}}').replace(/\{\{HUB_URL\}\}/g, hub_url || '{{HUB_URL}}').replace(/\{\{VERSION\}\}/g, version);
    } else {
      if (!api_key || !hub_url) return jsonResponse({ error: 'API key and hub URL required for template' }, 400);
      pluginCode = generateConnectorPluginCode(api_key, hub_url, version);
    }

    const zip = new JSZip();
    zip.file('wp-plugin-hub-connector/wp-plugin-hub-connector.php', pluginCode);
    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const fileName = `wp-plugin-hub-connector-v${version}.zip`;
    const uploadRes = await uploadToStorage(fileName, zipBytes, 'uploads', 'application/zip');

    // Create connector record in Supabase via REST
    const supaUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY');
    const connectorRes = await fetch(`${supaUrl}/rest/v1/connectors`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ version, plugin_code: pluginCode, file_url: uploadRes.file_url, description })
    });
    if (!connectorRes.ok) {
      const txt = await connectorRes.text().catch(()=>'');
      throw new Error('Failed to create connector: '+txt);
    }
    const connector = await connectorRes.json();

    // Update site_settings active_connector_version
    await fetch(`${supaUrl}/rest/v1/site_settings`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ setting_key: 'active_connector_version', setting_value: version, description: 'Active connector version' })
    }).catch(()=>{});

    return jsonResponse({ success: true, file_url: uploadRes.file_url, version, connector_id: connector[0]?.id || null });

  } catch (err: any) {
    console.error('generateConnectorPlugin error', err);
    return jsonResponse({ error: err.message || String(err) }, 500);
  }
});

export {};
