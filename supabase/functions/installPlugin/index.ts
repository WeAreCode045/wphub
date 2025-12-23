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
      // Delegate actual install work to the existing executePluginAction function
      await base44.asServiceRole.functions.invoke('executePluginAction', {
        action: 'install',
        site_id,
        plugin_slug,
        plugin_id
      });

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    } catch (err) {
      console.error('installPlugin invoke failed:', err);
      return new Response(JSON.stringify({ error: err?.message || 'install failed' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  } catch (err) {
    console.error('installPlugin error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});