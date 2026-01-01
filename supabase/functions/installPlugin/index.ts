import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { InstallPluginRequestSchema, z } from '../_shared/schemas.ts';

Deno.serve(async (req) => {
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

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Parse and validate request body with Zod
    let body;
    try {
      const bodyText = await req.text();
      const parsed = JSON.parse(bodyText);
      body = InstallPluginRequestSchema.parse(parsed);
    } catch (parseError) {
      console.error('[installPlugin] Validation error:', parseError);
      const error = parseError instanceof z.ZodError
        ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        : `Invalid request: ${parseError.message}`;
      return new Response(JSON.stringify({ error }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const { site_id, plugin_slug, plugin_id, download_url } = body;

    try {
      // Call executePluginAction directly via Supabase Functions HTTP endpoint using service role key
      const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const SUPA = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');

      if (!SERVICE_KEY || !SUPA) {
        console.error('installPlugin: missing SERVICE_KEY or SUPABASE_URL env');
        return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
      }

      const url = `${SUPA.replace(/\/$/, '')}/functions/v1/executePluginAction`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({ action: 'install', site_id, plugin_slug, file_url: download_url })
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
      return new Response(JSON.stringify(out), { status: statusCode, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    } catch (err) {
      console.error('installPlugin invoke failed:', err?.message || err);
      try { console.error('installPlugin invoke failed - stack:', err?.stack); } catch(e){}
      return new Response(JSON.stringify({ error: err?.message || 'install failed' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
  } catch (err) {
    console.error('installPlugin error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'internal' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});