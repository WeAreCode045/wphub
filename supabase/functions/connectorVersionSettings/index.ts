import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supaUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supaUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supaUrl, serviceKey);

    // GET: Retrieve current selected connector version
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'connector_version')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const setting = data ? JSON.parse(data.value || '{}') : null;

      return new Response(
        JSON.stringify({
          success: true,
          version: setting?.version || null,
          url: setting?.url || null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Set selected connector version
    if (req.method === 'POST') {
      const body = await req.json();
      const { version, url } = body;

      if (!version || !url) {
        return new Response(
          JSON.stringify({ error: 'Version and URL are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // First, try to get existing setting
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', 'connector_version')
        .single();

      const settingValue = JSON.stringify({ version, url, updated_at: new Date().toISOString() });

      let result;
      if (existing) {
        // Update existing
        result = await supabase
          .from('settings')
          .update({ value: settingValue })
          .eq('key', 'connector_version');
      } else {
        // Insert new
        result = await supabase
          .from('settings')
          .insert([{ key: 'connector_version', value: settingValue }]);
      }

      if (result.error) {
        return new Response(
          JSON.stringify({ error: result.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          version: version,
          url: url,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling connector version:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
