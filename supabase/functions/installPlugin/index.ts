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
      const res = await base44.asServiceRole.functions.invoke('executePluginAction', {
        action: 'install',
        site_id,
        plugin_slug,
        plugin_id
      });

      // If the shim returned null or undefined, log and treat as failure
      if (res == null) {
        console.error('installPlugin: executePluginAction returned null/undefined');
        return new Response(JSON.stringify({ error: 'executePluginAction returned no result' }), { status: 500, headers: { 'content-type': 'application/json' } });
      }

      // If the invoked function returned an object with an error, surface it
      if (typeof res === 'object' && (res.error || (res.data && res.data.error))) {
        console.error('installPlugin: executePluginAction error result:', JSON.stringify(res));
        const errMsg = res.error || res.data?.error || 'executePluginAction failed';
        return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: { 'content-type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, result: res }), { status: 200, headers: { 'content-type': 'application/json' } });
    } catch (err) {
      console.error('installPlugin invoke failed:', err?.message || err);
      try { console.error('installPlugin invoke failed - stack:', err?.stack); } catch(e){}
      // If the error contains a response object, stringify it
      if (err && typeof err === 'object' && ('response' in err)) {
        try { console.error('installPlugin invoke failed - response:', JSON.stringify(err.response)); } catch(e){}
      }
      return new Response(JSON.stringify({ error: err?.message || 'install failed', details: err && err.response ? err.response : null }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  } catch (err) {
    console.error('installPlugin error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});