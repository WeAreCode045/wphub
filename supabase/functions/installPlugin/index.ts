import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const body = await req.json();
    const { site_id, plugin_slug, plugin_id } = body || {};

    if (!site_id || (!plugin_slug && !plugin_id)) {
      return new Response(JSON.stringify({ error: 'Missing required params: site_id and plugin_slug or plugin_id' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    try {
      // Call executePluginAction directly via Supabase Functions HTTP endpoint using service role key
      const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const SUPA = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');

      if (!SERVICE_KEY || !SUPA) {
        console.error('installPlugin: missing SERVICE_KEY or SUPABASE_URL env');
        return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: { 'content-type': 'application/json' } });
      }

      const url = `${SUPA.replace(/\/$/, '')}/functions/v1/executePluginAction`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({ action: 'install', site_id, plugin_slug, plugin_id })
      });

      let bodyText = '';
      try { bodyText = await resp.text(); } catch(e) { bodyText = ''; }
      let parsed;
      try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch(e) { parsed = bodyText; }

      // Always return the raw remote function response for debugging
      const out = {
        ok: resp.ok,
        status: resp.status,
        response: parsed
      };

      // If remote returned non-ok, keep the same status code to surface it
      const statusCode = resp.ok ? 200 : 500;
      return new Response(JSON.stringify(out), { status: statusCode, headers: { 'content-type': 'application/json' } });
    } catch (err) {
      console.error('installPlugin invoke failed:', err?.message || err);
      try { console.error('installPlugin invoke failed - stack:', err?.stack); } catch(e){}
      return new Response(JSON.stringify({ error: err?.message || 'install failed' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  } catch (err) {
    console.error('installPlugin error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});